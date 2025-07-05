import { Handler } from "@netlify/functions";
import { trace, SpanStatusCode, SpanKind, context } from "@opentelemetry/api";
// Update import to use the local otel.ts file
import { initializeOtel, recordRequest, activeConnections } from "./otel";
import { logger } from "./logger";

// Initialize OpenTelemetry (only once)
let otelInitialized = false;
if (!otelInitialized) {
  initializeOtel();
  otelInitialized = true;
}

// Get tracer instance
const tracer = trace.getTracer("netlify-functions", "1.0.0");

const handler: Handler = async (event, context) => {
  const startTime = Date.now();
  
  // Track active connections
  activeConnections.add(1);
  
  // Create a span for the function execution
  return tracer.startActiveSpan(
    "hello-function",
    {
      kind: SpanKind.SERVER,
      attributes: {
        "http.method": event.httpMethod || "GET",
        "http.route": "/hello",
        "http.url": event.path || "/hello",
        "function.name": "hello",
        "cloud.provider": "netlify",
        "faas.name": "netlify-function",
        "request.id": context.awsRequestId || "unknown",
        "function.execution.start_time": startTime,
      },
    },
    async (span) => {
      let statusCode = 200;
      
      try {
        // Add additional attributes with proper semantic conventions
        span.setAttributes({
          "user_agent.original": event.headers?.["user-agent"] || "unknown",
          "client.address": event.headers?.["client-ip"] || 
                           event.headers?.["x-forwarded-for"] || 
                           "unknown",
          "http.request.size": event.body?.length || 0,
          "netlify.request_id": context.awsRequestId || "unknown",
          "netlify.function.memory_limit": context.memoryLimitInMB || 128,
          "netlify.function.remaining_time": context.getRemainingTimeInMillis?.() || 0,
        });

        // Generate a random number between 1 and 9
        const randomNumber = Math.floor(Math.random() * 9) + 1;
        span.setAttributes({ "random.number": randomNumber });

        // Add event for function start
        span.addEvent("function.start", {
          "random.number": randomNumber,
          "timestamp": startTime,
        });

        // Log function start with structured logging
        logger.logWithSpan("info", "Function execution started", {
          "function.name": "hello",
          "random.number": randomNumber,
          "request.id": context.awsRequestId || "unknown",
          "client.address": event.headers?.["client-ip"] || 
                           event.headers?.["x-forwarded-for"] || 
                           "unknown",
        });

        // If the random number is 1, return an error message (1 out of 9 times)
        const isError = randomNumber === 1;

        if (isError) {
          statusCode = 500;
          
          // Record error in span
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Random error occurred",
          });
          span.setAttributes({ 
            "http.response.status_code": statusCode,
            "error.type": "random_error"
          });

          // Add error event
          span.addEvent("function.error", {
            "error.type": "random_error",
            "error.message": "Random error occurred",
            "severity": "error",
          });

          // Record exception
          const error = new Error("netlify-ts hello error");
          span.recordException(error);

          // Log error with structured logging
          logger.logWithSpan("error", "Random error occurred during function execution", {
            "error.type": "random_error",
            "error.message": "Random error occurred",
            "function.name": "hello",
            "random.number": randomNumber,
            "request.id": context.awsRequestId || "unknown",
          });

          throw error;
        }

        // Success case
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({ "http.response.status_code": statusCode });

        // Add success event
        span.addEvent("function.success", {
          "response.message": "netlify-ts hello success",
          "severity": "info",
        });

        const message = "netlify-ts hello success";
        const responseSize = message.length;

        // Add response size
        span.setAttributes({
          "http.response.size": responseSize,
        });

        // Log success with structured logging
        logger.logWithSpan("info", "Function execution completed successfully", {
          "function.name": "hello",
          "response.message": message,
          "response.size": responseSize,
          "random.number": randomNumber,
          "request.id": context.awsRequestId || "unknown",
        });

        return {
          statusCode: 200,
          body: message,
          headers: {
            "Content-Type": "text/plain",
            "X-Trace-Id": span.spanContext().traceId,
            "X-Span-Id": span.spanContext().spanId,
          },
        };
      } catch (error) {
        statusCode = 500;
        
        // Handle errors and update span
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.setAttributes({ 
          "http.response.status_code": statusCode,
          "error.type": error instanceof Error ? error.constructor.name : "unknown"
        });

        if (error instanceof Error) {
          span.recordException(error);
        }

        // Log error with structured logging
        logger.logWithSpan("error", "Function execution failed with error", {
          "function.name": "hello",
          "error.type": error instanceof Error ? error.constructor.name : "unknown",
          "error.message": error instanceof Error ? error.message : "Unknown error",
          "request.id": context.awsRequestId || "unknown",
        });

        return {
          statusCode: 500,
          body: error instanceof Error ? error.message : "Unknown error",
          headers: {
            "Content-Type": "text/plain",
            "X-Trace-Id": span.spanContext().traceId,
            "X-Span-Id": span.spanContext().spanId,
          },
        };
      } finally {
        // Calculate duration
        const duration = Date.now() - startTime;
        
        // Record final metrics
        recordRequest(statusCode, duration);
        
        // Track active connections
        activeConnections.add(-1);
        
        // Add final span attributes
        span.setAttributes({
          "function.execution.duration_ms": duration,
          "function.execution.end_time": Date.now(),
        });
        
        // Add final event
        span.addEvent("function.end", {
          "duration_ms": duration,
          "status_code": statusCode,
        });

        // Log function completion with structured logging
        logger.logWithSpan("info", "Function execution completed", {
          "function.name": "hello",
          "duration_ms": duration,
          "status_code": statusCode,
          "request.id": context.awsRequestId || "unknown",
        });
        
        // End the span
        span.end();
      }
    }
  );
};

export { handler };
