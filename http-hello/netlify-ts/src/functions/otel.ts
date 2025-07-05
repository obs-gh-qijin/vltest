import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { metrics } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;
let meterProvider: MeterProvider | null = null;

// Create enhanced metrics
const meter = metrics.getMeter("netlify-functions", "1.0.0");

export const requestCounter = meter.createCounter("http.server.requests", {
  description: "Count of HTTP server requests",
});

export const requestDuration = meter.createHistogram("http.server.request_duration", {
  description: "Duration of HTTP server requests in milliseconds",
  unit: "ms",
});

export const errorCounter = meter.createCounter("http.server.errors", {
  description: "Count of HTTP server errors",
});

export const activeConnections = meter.createUpDownCounter("http.server.active_connections", {
  description: "Number of active HTTP connections",
});

// Enhanced function to record a request with more metrics
export const recordRequest = (statusCode: number, duration?: number) => {
  const labels = {
    "http.status_code": statusCode.toString(),
    "http.status_class": `${Math.floor(statusCode / 100)}xx`,
  };

  requestCounter.add(1, labels);
  
  if (duration !== undefined) {
    requestDuration.record(duration, labels);
  }
  
  if (statusCode >= 400) {
    errorCounter.add(1, labels);
  }
};

export const initializeOtel = () => {
  // Prevent multiple initializations
  if (sdk) {
    return sdk;
  }

  // Initialize from environment variables with proper fallbacks
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
  const ingestToken = process.env.OBSERVE_INGEST_TOKEN || process.env.OBSERVE_TOKEN;
  const serviceName = process.env.OTEL_SERVICE_NAME || "netlify-ts-functions";
  const serviceVersion = process.env.OTEL_SERVICE_VERSION || "1.0.0";

  if (!ingestToken) {
    console.warn("No OBSERVE_INGEST_TOKEN found, OpenTelemetry will not be initialized");
    return null;
  }

  try {
    // Create resource with semantic attributes
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.CLOUD_PROVIDER]: "netlify",
      [SemanticResourceAttributes.FAAS_NAME]: "netlify-function",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
    });

    // Configure headers for Observe
    const headers = {
      Authorization: `Bearer ${ingestToken}`,
      "x-observe-target-package": "Tracing",
    };

    // Create the OTLP trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${otelEndpoint}/v1/traces`,
      headers,
    });

    // Create the OTLP metric exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${otelEndpoint}/v1/metrics`,
      headers,
    });

    // Create and configure the meter provider
    meterProvider = new MeterProvider({
      resource,
      readers: [new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 30000, // Export every 30 seconds
      })],
    });

    // Register the meter provider
    metrics.setGlobalMeterProvider(meterProvider);

    // Initialize the SDK with resource attributes
    sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(traceExporter),
      instrumentations: [], // Add auto-instrumentations if needed
    });

    sdk.start();
    console.log(`OpenTelemetry initialized for service: ${serviceName}`);
    console.log(`Endpoint: ${otelEndpoint}`);
    console.log(`Resource attributes:`, resource.attributes);

    return sdk;
  } catch (error) {
    console.error("Error initializing OpenTelemetry:", error);
    return null;
  }
};

// Graceful shutdown
export const shutdownOtel = async () => {
  console.log("Shutting down OpenTelemetry...");
  
  try {
    // Shutdown metrics provider first
    if (meterProvider) {
      await meterProvider.shutdown();
      console.log("Metrics provider shut down successfully");
    }
    
    // Shutdown SDK
    if (sdk) {
      await sdk.shutdown();
      console.log("OpenTelemetry SDK shut down successfully");
    }
  } catch (error) {
    console.error("Error shutting down OpenTelemetry:", error);
  }
};

// Auto-shutdown on process exit (for local development)
if (process.env.NODE_ENV !== "production") {
  process.on("SIGTERM", () => {
    shutdownOtel().finally(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    shutdownOtel().finally(() => process.exit(0));
  });
}

