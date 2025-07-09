"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownOtel = exports.initializeOtel = exports.trackActiveRequest = exports.recordRequest = exports.errorCounter = exports.functionInvocations = exports.functionExecutionTime = exports.activeRequests = exports.requestDuration = exports.requestCounter = void 0;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const exporter_metrics_otlp_http_1 = require("@opentelemetry/exporter-metrics-otlp-http");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const api_1 = require("@opentelemetry/api");
const sdk_metrics_2 = require("@opentelemetry/sdk-metrics");
const api_2 = require("@opentelemetry/api");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const instrumentation_https_1 = require("@opentelemetry/instrumentation-https");
const instrumentation_dns_1 = require("@opentelemetry/instrumentation-dns");
const instrumentation_fs_1 = require("@opentelemetry/instrumentation-fs");
let sdk = null;
let meterProvider = null;
// Service configuration
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "netlify-ts-functions";
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || "1.0.0";
const ENVIRONMENT = process.env.OTEL_DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || "development";
// Enable OpenTelemetry diagnostics in development
if (ENVIRONMENT === "development") {
    api_2.diag.setLogger(new api_2.DiagConsoleLogger(), api_2.DiagLogLevel.INFO);
}
// Create comprehensive metrics
const meter = api_1.metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);
// HTTP request metrics
exports.requestCounter = meter.createCounter("http.server.requests", {
    description: "Total number of HTTP server requests",
});
exports.requestDuration = meter.createHistogram("http.server.request.duration", {
    description: "HTTP server request duration in milliseconds",
    unit: "ms",
});
exports.activeRequests = meter.createUpDownCounter("http.server.active_requests", {
    description: "Number of active HTTP server requests",
});
// Function performance metrics
exports.functionExecutionTime = meter.createHistogram("function.execution.duration", {
    description: "Function execution duration in milliseconds",
    unit: "ms",
});
exports.functionInvocations = meter.createCounter("function.invocations", {
    description: "Total number of function invocations",
});
// Error metrics
exports.errorCounter = meter.createCounter("function.errors", {
    description: "Total number of function errors",
});
// Function to record comprehensive request metrics
const recordRequest = (statusCode, duration, attributes) => {
    const baseAttributes = {
        "http.status_code": statusCode.toString(),
        "http.status_class": `${Math.floor(statusCode / 100)}xx`,
        "function.name": "hello",
        "service.name": SERVICE_NAME,
        ...attributes,
    };
    exports.requestCounter.add(1, baseAttributes);
    exports.functionInvocations.add(1, baseAttributes);
    if (duration !== undefined) {
        exports.requestDuration.record(duration, baseAttributes);
        exports.functionExecutionTime.record(duration, baseAttributes);
    }
    if (statusCode >= 400) {
        exports.errorCounter.add(1, {
            ...baseAttributes,
            "error.type": statusCode >= 500 ? "server_error" : "client_error",
        });
    }
};
exports.recordRequest = recordRequest;
// Function to track active requests
const trackActiveRequest = (increment) => {
    exports.activeRequests.add(increment ? 1 : -1, {
        "service.name": SERVICE_NAME,
        "function.name": "hello",
    });
};
exports.trackActiveRequest = trackActiveRequest;
const initializeOtel = () => {
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
        const resource = new resources_1.Resource({
            [semantic_conventions_1.ATTR_SERVICE_NAME]: SERVICE_NAME,
            [semantic_conventions_1.ATTR_SERVICE_VERSION]: SERVICE_VERSION,
            [semantic_conventions_1.ATTR_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
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
        const traceExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
            url: traceEndpoint,
            headers,
        });
        // Create the OTLP metrics exporter for Observe
        const metricsExporter = new exporter_metrics_otlp_http_1.OTLPMetricExporter({
            url: metricsEndpoint,
            headers: {
                Authorization: `Bearer ${ingestToken}`,
                "x-observe-target-package": "Metrics",
            },
        });
        // Create metrics reader
        const metricsReader = new sdk_metrics_1.PeriodicExportingMetricReader({
            exporter: metricsExporter,
            exportIntervalMillis: 10000, // Export every 10 seconds
        });
        // Configure auto-instrumentations
        const instrumentations = [
            // HTTP/HTTPS instrumentation for outgoing requests
            new instrumentation_http_1.HttpInstrumentation({
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
            new instrumentation_https_1.HttpsInstrumentation({
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
            new instrumentation_dns_1.DnsInstrumentation({
                ignoreIncomingRequestHook: () => false,
                ignoreOutgoingRequestHook: () => false,
            }),
            // File system instrumentation
            new instrumentation_fs_1.FsInstrumentation({
                ignoreIncomingRequestHook: () => false,
                ignoreOutgoingRequestHook: () => false,
            }),
            // Additional auto-instrumentations (with selective enablement)
            ...(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
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
        sdk = new sdk_node_1.NodeSDK({
            resource,
            spanProcessor: new sdk_trace_base_1.BatchSpanProcessor(traceExporter),
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
    }
    catch (error) {
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
        }
        catch (error) {
            console.error("Error shutting down OpenTelemetry:", error);
        }
    }
    process.exit(0);
};
exports.shutdownOtel = shutdownOtel;
// Auto-shutdown on process exit
process.on("SIGTERM", exports.shutdownOtel);
process.on("SIGINT", exports.shutdownOtel);