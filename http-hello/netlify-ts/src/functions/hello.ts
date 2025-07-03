import { Handler } from "@netlify/functions";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
// Update import to use the local otel.ts file
import { initializeOtel, recordRequest, trackActiveRequest } from "./otel";
import { logger } from "./logger";

// Initialize OpenTelemetry (only once)
let otelInitialized = false;
if (!otelInitialized) {
  initializeOtel();
  otelInitialized = true;
  logger.info("OpenTelemetry initialized for Netlify function", {
    "function.name": "hello",
    "initialization": "completed"
  });
}

// Get tracer instance
const tracer = trace.getTracer("netlify-functions", "1.0.0");

const handler: Handler = async (event, context) => {
  const startTime = Date.now();
  
  // Track active request
  trackActiveRequest(true);
  
  // Create a span for the function execution
  return tracer.startActiveSpan(
    "hello-function",
    {
      kind: SpanKind.SERVER,
      attributes: {
        "http.method": event.httpMethod || "GET",
        "http.route": "/hello",
        "http.scheme": "https",
        "function.name": "hello",
        "cloud.provider": "netlify",
        "cloud.platform": "netlify_functions",
        "request.id": context.awsRequestId || "unknown",
        "faas.execution": context.awsRequestId || "unknown",
      },
    },
    async (span) => {
      try {
        // Add additional attributes
        const userAgent = event.headers?.["user-agent"] || "unknown";
        const clientIp = event.headers?.["client-ip"] || 
                        event.headers?.["x-forwarded-for"] || 
                        "unknown";
        
        span.setAttributes({
          "user_agent.original": userAgent,
          "client.address": clientIp,
          "http.user_agent": userAgent,
          "source.ip": clientIp,
        });

        // Log function start with structured logging
        logger.info("Function execution started", {
          "function.name": "hello",
          "request.id": context.awsRequestId || "unknown",
          "http.method": event.httpMethod || "GET",
          "client.ip": clientIp,
          "user_agent": userAgent,
        });

        // Generate a random number between 1 and 9
        const randomNumber = Math.floor(Math.random() * 9) + 1;
        span.setAttributes({ "random.number": randomNumber });

        // Add event for function start
        span.addEvent("function.start", {
          "random.number": randomNumber,
          "timestamp": new Date().toISOString(),
        });

        // If the random number is 1, return an error message (1 out of 9 times)
        const isError = randomNumber === 1;

        if (isError) {
          const duration = Date.now() - startTime;
          
          // Record error in span
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Random error occurred",
          });
          span.setAttributes({ 
            "http.status_code": 500,
            "error.type": "random_error",
            "request.duration_ms": duration,
          });
          
          // Record the request metric with error status and duration
          recordRequest(500, duration);

          // Add error event
          span.addEvent("function.error", {
            "error.type": "random_error",
            "error.message": "Random error occurred",
            "timestamp": new Date().toISOString(),
          });

          // Record exception
          const error = new Error("netlify-ts hello error");
          span.recordException(error);
          
          // Structured error logging
          logger.error("Function execution failed", error, {
            "function.name": "hello",
            "request.id": context.awsRequestId || "unknown",
            "error.type": "random_error",
            "random.number": randomNumber,
            "duration_ms": duration,
          });

          throw error;
        }

        const duration = Date.now() - startTime;
        
        // Success case
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({ 
          "http.status_code": 200,
          "request.duration_ms": duration,
          "response.size": 26, // "netlify-ts hello success".length
        });
        
        // Record the request metric with success status and duration
        recordRequest(200, duration);

        // Add success event
        span.addEvent("function.success", {
          "response.message": "netlify-ts hello success",
          "timestamp": new Date().toISOString(),
          "duration_ms": duration,
        });

        // Structured success logging
        logger.info("Function execution completed successfully", {
          "function.name": "hello",
          "request.id": context.awsRequestId || "unknown",
          "random.number": randomNumber,
          "duration_ms": duration,
          "http.status_code": 200,
        });

        const message = "netlify-ts hello success";

        return {
          statusCode: 200,
          body: message,
          headers: {
            "Content-Type": "text/plain",
            "X-Trace-Id": span.spanContext().traceId,
            "X-Span-Id": span.spanContext().spanId,
            "X-Request-Duration": duration.toString(),
          },
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Handle errors and update span
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.setAttributes({ 
          "http.status_code": 500,
          "request.duration_ms": duration,
          "error.type": error instanceof Error ? error.constructor.name : "UnknownError",
        });
        
        // Record the request metric with error status and duration
        recordRequest(500, duration);

        if (error instanceof Error) {
          span.recordException(error);
        }
        
        // Structured error logging
        logger.error("Function execution failed with unexpected error", 
          error instanceof Error ? error : undefined, {
          "function.name": "hello",
          "request.id": context.awsRequestId || "unknown",
          "duration_ms": duration,
          "error.type": error instanceof Error ? error.constructor.name : "UnknownError",
        });

        return {
          statusCode: 500,
          body: error instanceof Error ? error.message : "Unknown error",
          headers: {
            "Content-Type": "text/plain",
            "X-Trace-Id": span.spanContext().traceId,
            "X-Span-Id": span.spanContext().spanId,
            "X-Request-Duration": duration.toString(),
          },
        };
      } finally {
        // Track active request completion
        trackActiveRequest(false);
        
        // End the span
        span.end();
      }
    }
  );
};

export { handler };
