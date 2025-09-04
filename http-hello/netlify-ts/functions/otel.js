"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownOtel = exports.initializeOtel = exports.recordRequest = exports.logger = exports.requestDuration = exports.requestCounter = void 0;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const exporter_metrics_otlp_http_1 = require("@opentelemetry/exporter-metrics-otlp-http");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const api_1 = require("@opentelemetry/api");

let sdk = null;

// Create metrics
const meter = api_1.metrics.getMeter("netlify-functions", "1.0.0");

exports.requestCounter = meter.createCounter("http.server.requests", {
    description: "Count of HTTP server requests",
});

exports.requestDuration = meter.createHistogram("http.server.duration", {
    description: "Duration of HTTP server requests in milliseconds",
    unit: "ms",
});

// Structured logger
exports.logger = {
    info: (message, attributes) => {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "info",
            message,
            ...attributes,
        }));
    },
    error: (message, attributes) => {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            message,
            ...attributes,
        }));
    },
    warn: (message, attributes) => {
        console.warn(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "warn",
            message,
            ...attributes,
        }));
    },
};

// Function to record a request with status code and duration
const recordRequest = (statusCode, duration) => {
    exports.requestCounter.add(1, {
        "http.status_code": statusCode.toString(),
        "status_class": `${Math.floor(statusCode / 100)}xx`,
    });
    exports.requestDuration.record(duration, {
        "http.status_code": statusCode.toString(),
        "status_class": `${Math.floor(statusCode / 100)}xx`,
    });
};
exports.recordRequest = recordRequest;

const initializeOtel = () => {
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
        const resource = (0, resources_1.resourceFromAttributes)({
            [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: serviceName,
            [semantic_conventions_1.SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
        });
        
        // Create the OTLP trace exporter
        const traceExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
            url: `${otelEndpoint}/v1/traces`,
            headers,
        });
        
        // Create the OTLP metrics exporter
        const metricExporter = new exporter_metrics_otlp_http_1.OTLPMetricExporter({
            url: `${otelEndpoint}/v1/metrics`,
            headers,
        });
        
        // Initialize the SDK with resource attributes
        sdk = new sdk_node_1.NodeSDK({
            resource,
            spanProcessor: new sdk_trace_base_1.BatchSpanProcessor(traceExporter),
            metricReader: new sdk_metrics_1.PeriodicExportingMetricReader({
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
exports.initializeOtel = initializeOtel;

// Graceful shutdown
const shutdownOtel = async () => {
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
exports.shutdownOtel = shutdownOtel;

// Auto-shutdown on process exit
process.on("SIGTERM", exports.shutdownOtel);
process.on("SIGINT", exports.shutdownOtel);