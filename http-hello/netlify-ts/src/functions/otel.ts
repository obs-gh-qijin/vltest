import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions";
import { metrics } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

let sdk: NodeSDK | null = null;
let meterProvider: MeterProvider | null = null;

// Get meter instance
const meter = metrics.getMeter("netlify-functions", "1.0.0");

// Create comprehensive metrics
export const requestCounter = meter.createCounter("http.server.requests", {
  description: "Count of HTTP server requests",
});

export const requestDuration = meter.createHistogram("http.server.request.duration", {
  description: "Duration of HTTP server requests in milliseconds",
  unit: "ms",
});

export const activeRequests = meter.createUpDownCounter("http.server.active_requests", {
  description: "Number of active HTTP server requests",
});

export const errorCounter = meter.createCounter("http.server.errors", {
  description: "Count of HTTP server errors",
});

// Function to record a request with status code and duration
export const recordRequest = (statusCode: number, duration?: number) => {
  const attributes = {
    "http.status_code": statusCode.toString(),
    "http.status_class": `${Math.floor(statusCode / 100)}xx`,
  };
  
  requestCounter.add(1, attributes);
  
  if (duration !== undefined) {
    requestDuration.record(duration, attributes);
  }
  
  // Record errors separately
  if (statusCode >= 400) {
    errorCounter.add(1, attributes);
  }
};

// Function to track active requests
export const trackActiveRequest = (increment: boolean) => {
  activeRequests.add(increment ? 1 : -1);
};

export const initializeOtel = () => {
  // Prevent multiple initializations
  if (sdk) {
    return sdk;
  }

  // Initialize from environment variables with fallbacks
  const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
  const traceEndpoint = `${baseEndpoint}/v1/traces`;
  const metricsEndpoint = `${baseEndpoint}/v1/metrics`;

  const ingestToken =
    process.env.OBSERVE_INGEST_TOKEN || process.env.OBSERVE_TOKEN || "your_observe_ingest_token_here";
  const serviceName = process.env.OTEL_SERVICE_NAME || "netlify-ts-functions";
  const serviceVersion = process.env.OTEL_SERVICE_VERSION || "1.0.0";
  const environment = process.env.OTEL_DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || "development";

  try {
    // Create resource with comprehensive attributes
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      "service.instance.id": process.env.AWS_LAMBDA_FUNCTION_NAME || "netlify-function",
      "cloud.provider": "netlify",
      "cloud.platform": "netlify_functions",
      "faas.name": process.env.AWS_LAMBDA_FUNCTION_NAME || "hello",
      "faas.version": process.env.AWS_LAMBDA_FUNCTION_VERSION || "$LATEST",
    });

    // Headers for Observe (or other OTLP backends)
    const headers = {
      Authorization: `Bearer ${ingestToken}`,
      "x-observe-target-package": "Tracing",
    };

    // Create the OTLP trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: traceEndpoint,
      headers,
    });

    // Create the OTLP metrics exporter
    const metricsExporter = new OTLPMetricExporter({
      url: metricsEndpoint,
      headers: {
        Authorization: `Bearer ${ingestToken}`,
        "x-observe-target-package": "Metrics",
      },
    });

    // Initialize metrics provider
    meterProvider = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricsExporter,
          exportIntervalMillis: 5000, // Export every 5 seconds
        }),
      ],
    });

    // Set the global meter provider
    metrics.setGlobalMeterProvider(meterProvider);

    // Initialize the SDK with resource attributes and auto-instrumentations
    sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(traceExporter),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Configure auto-instrumentations
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span, request) => {
              span.setAttributes({
                'http.request.method': request.method,
                'http.request.url': request.url,
              });
            },
          },
          '@opentelemetry/instrumentation-dns': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable to reduce noise in serverless
          },
          '@opentelemetry/instrumentation-net': {
            enabled: true,
          },
        }),
      ],
    });

    sdk.start();
    console.log(`OpenTelemetry initialized for service: ${serviceName}`);
    console.log(`Tracing endpoint: ${traceEndpoint}`);
    console.log(`Metrics endpoint: ${metricsEndpoint}`);
    console.log(`Environment: ${environment}`);

    return sdk;
  } catch (error) {
    console.error("Error initializing OpenTelemetry:", error);
    return null;
  }
};

// Graceful shutdown
export const shutdownOtel = async () => {
  try {
    if (meterProvider) {
      await meterProvider.shutdown();
      console.log("OpenTelemetry metrics provider shut down successfully");
    }
    if (sdk) {
      await sdk.shutdown();
      console.log("OpenTelemetry SDK shut down successfully");
    }
  } catch (error) {
    console.error("Error shutting down OpenTelemetry:", error);
  }
  process.exit(0);
};

// Auto-shutdown on process exit
process.on("SIGTERM", shutdownOtel);
process.on("SIGINT", shutdownOtel);

