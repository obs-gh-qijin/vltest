import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { metrics, logs } from "@opentelemetry/api";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";

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

// Get logger instance for structured logging
export const getLogger = () => {
  return logs.getLogger("netlify-functions", "1.0.0");
};

export const initializeOtel = () => {
  // Prevent multiple initializations
  if (sdk) {
    return sdk;
  }

  // Initialize from environment variables with fallbacks
  const otelTraceEndpoint =
    (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    "http://localhost:4318")+ "/v1/traces";

  // Hardcoded logs endpoint as specified
  const otelLogsEndpoint = "https://ds15mfSgBlKQVdG2edNV:SPQMc-N7hnIg2EwperqseHNsRKyMDumx@191369360817.collect.observe-eng.com/v2/otel/v1/logs";

  const ingestToken =
    process.env.OBSERVE_TOKEN || "your_observe_ingest_token_here";
  const serviceName = process.env.OTEL_SERVICE_NAME || "netlify-ts-functions";

  try {
    // Hard-coded headers for Observe traces
    const traceHeaders = {
      Authorization: `Bearer ${ingestToken}`,
      "x-observe-target-package": "Tracing",
    };

    // Create the OTLP trace exporter for Observe
    const traceExporter = new OTLPTraceExporter({
      url: otelTraceEndpoint,
      headers: traceHeaders,
    });

    // Create the OTLP logs exporter with the specified endpoint
    const logExporter = new OTLPLogExporter({
      url: otelLogsEndpoint,
    });

    // Initialize the SDK with resource attributes
    sdk = new NodeSDK({
      serviceName,
      spanProcessor: new BatchSpanProcessor(traceExporter),
      logRecordProcessor: new BatchLogRecordProcessor(logExporter),
      instrumentations: [], // Add auto-instrumentations if needed
    });

    sdk.start();
    console.log(`OpenTelemetry initialized for service: ${serviceName}`);
    console.log(`Tracing endpoint: ${otelTraceEndpoint}`);
    console.log(`Logs endpoint: ${otelLogsEndpoint}`);

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

