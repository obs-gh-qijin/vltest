"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const otel_1 = require("./otel");
// Initialize OpenTelemetry (only once)
if (!global.otelInitialized) {
    try {
        const result = (0, otel_1.initializeOtel)();
        global.otelInitialized = true;
        console.log("OpenTelemetry initialization completed successfully");
    }
    catch (error) {
        console.error("Failed to initialize OpenTelemetry:", error);
        // Continue without OpenTelemetry if initialization fails
        // This ensures the function still works even if observability fails
    }
}
// Get tracer instance
const tracer = api_1.trace.getTracer("netlify-functions", "1.0.0");
// Structured logging with trace correlation
const createLogger = (traceId, spanId) => {
    const baseContext = {
        service: "netlify-ts-functions",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
        ...(traceId && { traceId }),
        ...(spanId && { spanId }),
    };
    return {
        info: (message, attributes) => {
            console.log(JSON.stringify({ level: "info", message, ...baseContext, ...attributes }));
        },
        warn: (message, attributes) => {
            console.warn(JSON.stringify({ level: "warn", message, ...baseContext, ...attributes }));
        },
        error: (message, error, attributes) => {
            const errorDetails = error instanceof Error ? {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                }
            } : { error };
            console.error(JSON.stringify({ level: "error", message, ...baseContext, ...errorDetails, ...attributes }));
        },
    };
};
const handler = async (event, context) => {
    const startTime = Date.now();
    // Track active request (safely)
    try {
        (0, otel_1.trackActiveRequest)(true);
    }
    catch (error) {
        console.error("Failed to track active request:", error);
    }
    // Create a span for the function execution with semantic conventions
    return tracer.startActiveSpan("hello-function", {
        kind: api_1.SpanKind.SERVER,
        attributes: {
            [semantic_conventions_1.ATTR_HTTP_REQUEST_METHOD]: event.httpMethod || "GET",
            [semantic_conventions_1.ATTR_HTTP_ROUTE]: "/hello",
            "function.name": "hello",
            "cloud.provider": "netlify",
            "cloud.platform": "netlify_functions",
            "faas.name": "hello",
            "faas.trigger": "http",
            "request.id": context.awsRequestId || "unknown",
            "netlify.request_id": context.awsRequestId || "unknown",
        },
    }, async (span) => {
        const spanContext = span.spanContext();
        const logger = createLogger(spanContext.traceId, spanContext.spanId);
        try {
            // Add additional semantic attributes
            const userAgent = event.headers?.["user-agent"] || "unknown";
            const clientIp = event.headers?.["client-ip"] || event.headers?.["x-forwarded-for"] || "unknown";
            span.setAttributes({
                [semantic_conventions_1.ATTR_USER_AGENT_ORIGINAL]: userAgent,
                [semantic_conventions_1.ATTR_CLIENT_ADDRESS]: clientIp,
                "http.request.header.host": event.headers?.["host"] || "unknown",
                "http.request.header.accept": event.headers?.["accept"] || "unknown",
            });
            // Log function start
            logger.info("Function execution started", {
                httpMethod: event.httpMethod || "GET",
                route: "/hello",
                userAgent,
                clientIp,
                requestId: context.awsRequestId || "unknown",
            });
            // Generate a random number between 1 and 9
            const randomNumber = Math.floor(Math.random() * 9) + 1;
            span.setAttributes({ "random.number": randomNumber });
            // Add event for function start
            span.addEvent("function.start", {
                "random.number": randomNumber,
                "function.cold_start": !global.otelInitialized,
            });
            // If the random number is 1, return an error message (1 out of 9 times)
            const isError = randomNumber === 1;
            if (isError) {
                const errorMessage = "Random error occurred";
                const error = new Error("netlify-ts hello error");
                // Record error in span
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: errorMessage,
                });
                span.setAttributes({
                    [semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE]: 500,
                    "error.type": "random_error",
                    "error.message": errorMessage,
                });
                // Calculate duration and record metrics
                const duration = Date.now() - startTime;
                try {
                    (0, otel_1.recordRequest)(500, duration, {
                        "http.method": event.httpMethod || "GET",
                        "error.type": "random_error",
                    });
                }
                catch (error) {
                    console.error("Failed to record request metrics:", error);
                }
                // Add error event
                span.addEvent("function.error", {
                    "error.type": "random_error",
                    "error.message": errorMessage,
                    "random.number": randomNumber,
                });
                // Record exception
                span.recordException(error);
                // Log error
                logger.error("Function execution failed", error, {
                    randomNumber,
                    statusCode: 500,
                    duration,
                });
                throw error;
            }
            // Success case
            span.setStatus({ code: api_1.SpanStatusCode.OK });
            span.setAttributes({ [semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE]: 200 });
            // Calculate duration and record metrics
            const duration = Date.now() - startTime;
            try {
                (0, otel_1.recordRequest)(200, duration, {
                    "http.method": event.httpMethod || "GET",
                });
            }
            catch (error) {
                console.error("Failed to record request metrics:", error);
            }
            // Add success event
            span.addEvent("function.success", {
                "response.message": "netlify-ts hello success",
                "random.number": randomNumber,
                "duration.ms": duration,
            });
            const message = "netlify-ts hello success";
            // Log success
            logger.info("Function execution completed successfully", {
                randomNumber,
                statusCode: 200,
                duration,
                responseMessage: message,
            });
            return {
                statusCode: 200,
                body: message,
                headers: {
                    "Content-Type": "text/plain",
                    "X-Trace-Id": spanContext.traceId,
                    "X-Span-Id": spanContext.spanId,
                },
            };
        }
        catch (error) {
            // Handle errors and update span
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: errorMessage,
            });
            span.setAttributes({
                [semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE]: 500,
                "error.type": "unhandled_error",
            });
            // Calculate duration and record metrics
            const duration = Date.now() - startTime;
            try {
                (0, otel_1.recordRequest)(500, duration, {
                    "http.method": event.httpMethod || "GET",
                    "error.type": "unhandled_error",
                });
            }
            catch (error) {
                console.error("Failed to record request metrics:", error);
            }
            if (error instanceof Error) {
                span.recordException(error);
            }
            // Log error
            logger.error("Function execution failed with unhandled error", error, {
                statusCode: 500,
                duration,
            });
            return {
                statusCode: 500,
                body: errorMessage,
                headers: {
                    "Content-Type": "text/plain",
                    "X-Trace-Id": spanContext.traceId,
                    "X-Span-Id": spanContext.spanId,
                },
            };
        }
        finally {
            // Track active request completion (safely)
            try {
                (0, otel_1.trackActiveRequest)(false);
            }
            catch (error) {
                console.error("Failed to track active request completion:", error);
            }
            // End the span
            span.end();
        }
    });
};
exports.handler = handler;