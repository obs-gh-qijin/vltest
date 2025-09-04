import { Handler } from "@netlify/functions";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { SEMATTRS_HTTP_METHOD, SEMATTRS_HTTP_ROUTE, SEMATTRS_HTTP_STATUS_CODE, SEMATTRS_HTTP_USER_AGENT } from "@opentelemetry/semantic-conventions";
// Update import to use the local otel.ts file
import { initializeOtel, recordRequest, logger } from "./otel";

// Initialize OpenTelemetry (only once)
let otelInitialized = false;
if (!otelInitialized) {
  initializeOtel();
  otelInitialized = true;
}

// Get tracer instance
const tracer = trace.getTracer("netlify-functions", "1.0.0");

const handler: Handler = async (event, context) => {
  // Create a span for the function execution
  return tracer.startActiveSpan(
    "GET /hello",
    {
      kind: SpanKind.SERVER,
      attributes: {
        [SEMATTRS_HTTP_METHOD]: event.httpMethod || "GET",
        [SEMATTRS_HTTP_ROUTE]: "/hello",
        "function.name": "hello",
        "cloud.provider": "netlify",
        "faas.name": "hello",
        "faas.trigger": "http",
        "request.id": context.awsRequestId || "unknown",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        // Add additional attributes using semantic conventions
        span.setAttributes({
          [SEMATTRS_HTTP_USER_AGENT]: event.headers?.["user-agent"] || "unknown",
          "client.address":
            event.headers?.["client-ip"] ||
            event.headers?.["x-forwarded-for"] ||
            "unknown",
        });

        // Log function start with trace context
        logger.info("Function execution started", {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          functionName: "hello",
          httpMethod: event.httpMethod || "GET",
          userAgent: event.headers?.["user-agent"] || "unknown",
        });

        // Generate a random number between 1 and 9
        const randomNumber = Math.floor(Math.random() * 9) + 1;
        span.setAttributes({ "random.number": randomNumber });

        // Add event for function start
        span.addEvent("function.start", {
          "random.number": randomNumber,
        });

        // If the random number is 1, return an error message (1 out of 9 times)
        const isError = randomNumber === 1;

        if (isError) {
          // Record error in span
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Random error occurred",
          });
          span.setAttributes({ [SEMATTRS_HTTP_STATUS_CODE]: 500 });

          // Record the request metric with error status
          recordRequest(500, Date.now() - startTime);

          // Add error event
          span.addEvent("function.error", {
            "error.type": "random_error",
            "error.message": "Random error occurred",
          });

          // Log error with trace context
          logger.error("Function execution failed", {
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
            error: "Random error occurred",
            statusCode: 500,
            duration: Date.now() - startTime,
          });

          // Record exception
          const error = new Error("netlify-ts hello error");
          span.recordException(error);

          throw error;
        }

        // Success case
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({ [SEMATTRS_HTTP_STATUS_CODE]: 200 });

        // Record the request metric with success status
        recordRequest(200, Date.now() - startTime);

        // Add success event
        span.addEvent("function.success", {
          "response.message": "netlify-ts hello success",
        });

        const message = "netlify-ts hello success";
        const duration = Date.now() - startTime;

        // Log success with trace context
        logger.info("Function execution completed successfully", {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          statusCode: 200,
          duration,
          responseMessage: message,
        });

        return {
          statusCode: 200,
          body: message,
          headers: {
            "Content-Type": "text/plain",
            "X-Trace-Id": span.spanContext().traceId,
          },
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        // Handle errors and update span
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.setAttributes({ [SEMATTRS_HTTP_STATUS_CODE]: 500 });

        // Record the request metric with error status
        recordRequest(500, duration);

        if (error instanceof Error) {
          span.recordException(error);
        }

        // Log error with trace context
        logger.error("Function execution failed with exception", {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          error: error instanceof Error ? error.message : "Unknown error",
          statusCode: 500,
          duration,
        });

        return {
          statusCode: 500,
          body: error instanceof Error ? error.message : "Unknown error",
          headers: {
            "Content-Type": "text/plain",
            "X-Trace-Id": span.spanContext().traceId,
          },
        };
      } finally {
        // End the span
        span.end();
      }
    }
  );
};

export { handler };
