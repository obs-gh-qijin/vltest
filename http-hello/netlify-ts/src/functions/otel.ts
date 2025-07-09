import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions";
import { metrics, logs } from "@opentelemetry/api";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { HttpsInstrumentation } from "@opentelemetry/instrumentation-https";
import { DnsInstrumentation } from "@opentelemetry/instrumentation-dns";
import { FsInstrumentation } from "@opentelemetry/instrumentation-fs";

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

    const ingestToken = process.env.OBSERVE_INGEST_TOKEN || process.env.OBSERVE_TOKEN || "your_observe_ingest_token_here";

    // Create comprehensive resource attributes
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
      [ATTR_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
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

    // Create metrics reader
    const metricsReader = new PeriodicExportingMetricReader({
      exporter: metricsExporter,
      exportIntervalMillis: 10000, // Export every 10 seconds
    });

    // Configure auto-instrumentations
    const instrumentations = [
      // HTTP/HTTPS instrumentation for outgoing requests
      new HttpInstrumentation({
        responseHook: (span, response) => {
          span.setAttributes({
            "http.response.status_code": response.statusCode || 0,
            "http.response.status_text": response.statusMessage || "unknown",
          });
        },
        requestHook: (span, request) => {
          span.setAttributes({
            "http.request.method": request.method || "GET",
            "http.request.url": request.url || "unknown",
          });
        },
      }),
      new HttpsInstrumentation({
        responseHook: (span, response) => {
          span.setAttributes({
            "https.response.status_code": response.statusCode || 0,
            "https.response.status_text": response.statusMessage || "unknown",
          });
        },
        requestHook: (span, request) => {
          span.setAttributes({
            "https.request.method": request.method || "GET",
            "https.request.url": request.url || "unknown",
          });
        },
      }),
      // DNS instrumentation for DNS lookups
      new DnsInstrumentation({
        ignoreIncomingRequestHook: () => false,
        ignoreOutgoingRequestHook: () => false,
      }),
      // File system instrumentation
      new FsInstrumentation({
        ignoreIncomingRequestHook: () => false,
        ignoreOutgoingRequestHook: () => false,
      }),
      // Additional auto-instrumentations (with selective enablement)
      ...getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          enabled: false, // We're using custom HTTP instrumentation above
        },
        '@opentelemetry/instrumentation-https': {
          enabled: false, // We're using custom HTTPS instrumentation above
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false, // We're using custom DNS instrumentation above
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // We're using custom FS instrumentation above
        },
        '@opentelemetry/instrumentation-express': {
          enabled: false, // Not needed for Netlify Functions
        },
        '@opentelemetry/instrumentation-koa': {
          enabled: false, // Not needed for Netlify Functions
        },
        '@opentelemetry/instrumentation-fastify': {
          enabled: false, // Not needed for Netlify Functions
        },
        '@opentelemetry/instrumentation-hapi': {
          enabled: false, // Not needed for Netlify Functions
        },
        '@opentelemetry/instrumentation-mysql': {
          enabled: false, // Enable if using MySQL
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: false, // Enable if using PostgreSQL
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: false, // Enable if using Redis
        },
        '@opentelemetry/instrumentation-aws-lambda': {
          enabled: false, // Not needed for Netlify Functions
        },
      }),
    ];

    // Initialize the SDK with enhanced configuration
    sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(traceExporter),
      metricReader: metricsReader,
      instrumentations,
    });

    sdk.start();
    
    console.log(`OpenTelemetry initialized successfully:`);
    console.log(`  Service: ${SERVICE_NAME}@${SERVICE_VERSION}`);
    console.log(`  Environment: ${ENVIRONMENT}`);
    console.log(`  Trace endpoint: ${traceEndpoint}`);
    console.log(`  Metrics endpoint: ${metricsEndpoint}`);

    return sdk;
  } catch (error) {
    console.error("Error initializing OpenTelemetry:", error);
    return null;
  }
};

// Graceful shutdown
export const shutdownOtel = async () => {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log("OpenTelemetry shut down successfully");
    } catch (error) {
      console.error("Error shutting down OpenTelemetry:", error);
    }
  }
  process.exit(0);
};

// Auto-shutdown on process exit
process.on("SIGTERM", shutdownOtel);
process.on("SIGINT", shutdownOtel);

