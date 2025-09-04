import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { metrics } from "@opentelemetry/api";

let sdk: NodeSDK | null = null;

// Create metrics
const meter = metrics.getMeter("netlify-functions", "1.0.0");

export const requestCounter = meter.createCounter("http.server.requests", {
  description: "Count of HTTP server requests",
});

export const requestDuration = meter.createHistogram("http.server.duration", {
  description: "Duration of HTTP server requests in milliseconds",
  unit: "ms",
});

// Structured logger
export const logger = {
  info: (message: string, attributes?: Record<string, any>) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      ...attributes,
    }));
  },
  error: (message: string, attributes?: Record<string, any>) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      ...attributes,
    }));
  },
  warn: (message: string, attributes?: Record<string, any>) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      ...attributes,
    }));
  },
};

// Function to record a request with status code and duration
export const recordRequest = (statusCode: number, duration: number) => {
  requestCounter.add(1, {
    "http.status_code": statusCode.toString(),
    "status_class": `${Math.floor(statusCode / 100)}xx`,
  });

  requestDuration.record(duration, {
    "http.status_code": statusCode.toString(),
    "status_class": `${Math.floor(statusCode / 100)}xx`,
  });
};

export const initializeOtel = () => {
  // Prevent multiple initializations
  if (sdk) {
    return sdk;
  }

  // Initialize from environment variables with fallbacks
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
  const bearerToken = process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN || "your_bearer_token_here";
  const serviceName = process.env.OTEL_SERVICE_NAME || "netlify-ts-functions";
  const serviceVersion = process.env.OTEL_SERVICE_VERSION || "1.0.0";

  try {
    // Create headers for authentication
    const headers = {
      Authorization: `Bearer ${bearerToken}`,
    };

    // Create resource with service information
    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    });

    // Create the OTLP trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${otelEndpoint}/v1/traces`,
      headers,
    });

    // Create the OTLP metrics exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${otelEndpoint}/v1/metrics`,
      headers,
    });

    // Initialize the SDK with resource attributes
    sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(traceExporter),
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 10000, // Export every 10 seconds
      }),
      instrumentations: [], // Add auto-instrumentations if needed
    });

    sdk.start();
    console.log(`OpenTelemetry initialized for service: ${serviceName}`);
    console.log(`Tracing endpoint: ${otelEndpoint}/v1/traces`);
    console.log(`Metrics endpoint: ${otelEndpoint}/v1/metrics`);

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

