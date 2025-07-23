import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions";
import { metrics, diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { MeterProvider } from "@opentelemetry/sdk-metrics";

let sdk: NodeSDK | null = null;
let meterProvider: MeterProvider | null = null;

// Service configuration
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "netlify-ts-functions";
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || "1.0.0";
const ENVIRONMENT = process.env.OTEL_DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || "development";

// Enable OpenTelemetry diagnostics in development
if (ENVIRONMENT === "development") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

// Create comprehensive metrics
const meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);

// HTTP request metrics
export const requestCounter = meter.createCounter("http.server.requests", {
  description: "Total number of HTTP server requests",
});

export const requestDuration = meter.createHistogram("http.server.request.duration", {
  description: "HTTP server request duration in milliseconds",
  unit: "ms",
});

export const activeRequests = meter.createUpDownCounter("http.server.active_requests", {
  description: "Number of active HTTP server requests",
});

// Function performance metrics
export const functionExecutionTime = meter.createHistogram("function.execution.duration", {
  description: "Function execution duration in milliseconds",
  unit: "ms",
});

export const functionInvocations = meter.createCounter("function.invocations", {
  description: "Total number of function invocations",
});

// Error metrics
export const errorCounter = meter.createCounter("function.errors", {
  description: "Total number of function errors",
});

// Function to record comprehensive request metrics
export const recordRequest = (statusCode: number, duration?: number, attributes?: Record<string, string>) => {
  const baseAttributes = {
    "http.status_code": statusCode.toString(),
    "http.status_class": `${Math.floor(statusCode / 100)}xx`,
    "function.name": "hello",
    "service.name": SERVICE_NAME,
    ...attributes,
  };

  requestCounter.add(1, baseAttributes);
  functionInvocations.add(1, baseAttributes);
  
  if (duration !== undefined) {
    requestDuration.record(duration, baseAttributes);
    functionExecutionTime.record(duration, baseAttributes);
  }
  
  if (statusCode >= 400) {
    errorCounter.add(1, {
      ...baseAttributes,
      "error.type": statusCode >= 500 ? "server_error" : "client_error",
    });
  }
};

// Function to track active requests
export const trackActiveRequest = (increment: boolean) => {
  activeRequests.add(increment ? 1 : -1, {
    "service.name": SERVICE_NAME,
    "function.name": "hello",
  });
};

export const initializeOtel = () => {
  // Prevent multiple initializations
  if (sdk) {
    return sdk;
  }

  try {
    // Initialize from environment variables with fallbacks
    const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
    const traceEndpoint = `${baseEndpoint}/v1/traces`;
    const metricsEndpoint = `${baseEndpoint}/v1/metrics`;

    const ingestToken = process.env.OBSERVE_INGEST_TOKEN || process.env.OBSERVE_TOKEN;

    if (!ingestToken) {
      console.warn("Warning: No Observe ingest token provided. Set OBSERVE_INGEST_TOKEN environment variable for proper observability data export.");
    }

    // Create comprehensive resource attributes
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
      "service.instance.id": process.env.AWS_LAMBDA_FUNCTION_NAME || "netlify-function",
      "cloud.provider": "netlify",
      "cloud.platform": "netlify_functions",
      "faas.name": "hello",
      "faas.version": SERVICE_VERSION,
      "faas.runtime": "nodejs",
      "faas.runtime.version": process.version,
      "telemetry.sdk.name": "opentelemetry",
      "telemetry.sdk.language": "nodejs",
      "telemetry.sdk.version": "1.0.0",
    });

    // Headers for Observe
    const headers = {
      Authorization: `Bearer ${ingestToken}`,
      "x-observe-target-package": "Tracing",
    };

    // Create the OTLP trace exporter for Observe
    const traceExporter = new OTLPTraceExporter({
      url: traceEndpoint,
      headers,
    });

    // Create the OTLP metrics exporter for Observe
    const metricsExporter = new OTLPMetricExporter({
      url: metricsEndpoint,
      headers: {
        Authorization: `Bearer ${ingestToken}`,
        "x-observe-target-package": "Metrics",
      },
    });

    // Create metrics reader optimized for serverless
    const metricsReader = new PeriodicExportingMetricReader({
      exporter: metricsExporter,
      exportIntervalMillis: 10000, // Export every 10 seconds for faster feedback
    });

    // Minimal instrumentation for Netlify Functions - disable most to reduce cold start time
    const instrumentations: any[] = [];

    // Initialize the SDK with minimal configuration
    sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(traceExporter) as any,
      metricReader: metricsReader as any,
      instrumentations,
    });

    sdk.start();
    
    console.log(`OpenTelemetry initialized successfully:`);
    console.log(`  Service: ${SERVICE_NAME}@${SERVICE_VERSION}`);
    console.log(`  Environment: ${ENVIRONMENT}`);
    console.log(`  Trace endpoint: ${traceEndpoint}`);
    console.log(`  Metrics endpoint: ${metricsEndpoint}`);
    console.log(`  Token configured: ${ingestToken ? 'Yes' : 'No'}`);
    console.log(`  Diagnostics enabled: ${ENVIRONMENT === 'development' ? 'Yes' : 'No'}`);

    return sdk;
  } catch (error) {
    console.error("Error initializing OpenTelemetry:", error);
    return null;
  }
};

// Graceful shutdown (simplified for serverless)
export const shutdownOtel = async () => {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log("OpenTelemetry shut down successfully");
    } catch (error) {
      console.error("Error shutting down OpenTelemetry:", error);
    }
  }
};