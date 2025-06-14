import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { metrics } from "@opentelemetry/api";

let sdk: NodeSDK | null = null;

// Create a counter for HTTP requests
export const requestCounter = metrics
  .getMeter("netlify-functions")
  .createCounter("http.server.requests", {
    description: "Count of HTTP server requests",
  });

// Function to record a request with status code
export const recordRequest = (statusCode: number) => {
  requestCounter.add(1, {
    "http.status_code": statusCode.toString(),
  });
};

export const initializeOtel = () => {
  // Prevent multiple initializations
  if (sdk) {
    return sdk;
  }

  // Initialize from environment variables with fallbacks
  const otelEndpoint =
    (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    "http://localhost:4318")+ "/v1/traces";

  const ingestToken =
    process.env.OBSERVE_TOKEN || "your_observe_ingest_token_here";
  const serviceName = process.env.OTEL_SERVICE_NAME || "netlify-ts-functions";

  try {
    // Hard-coded headers for Observe

    const headers = {
      // Authorization: `Bearer ${ingestToken}`,
      // "x-observe-target-package": "Tracing",
    };

    // Create the OTLP trace exporter for Observe
    const traceExporter = new OTLPTraceExporter({
      url: otelEndpoint,
      headers,
    });

    // Initialize the SDK with resource attributes
    sdk = new NodeSDK({
      serviceName,
      spanProcessor: new BatchSpanProcessor(traceExporter),
      instrumentations: [], // Add auto-instrumentations if needed
    });

    sdk.start();
    console.log(`OpenTelemetry initialized for service: ${serviceName}`);
    console.log(`Tracing endpoint: ${otelEndpoint}`);

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
};

// Auto-shutdown on process exit
process.on("SIGTERM", shutdownOtel);
process.on("SIGINT", shutdownOtel);
