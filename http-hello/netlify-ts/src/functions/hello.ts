import { Handler } from "@netlify/functions";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
// Update import to use the local otel.ts file
import { initializeOtel, recordRequest } from "./otel";

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
    "hello-function",
    {
      kind: SpanKind.SERVER,
      attributes: {
        "http.method": event.httpMethod || "GET",
        "http.route": "/hello",
        "function.name": "hello",
        "cloud.provider": "netlify",
        "request.id": context.awsRequestId || "unknown",
      },
    },
    async (span) => {
      try {
        // Add additional attributes
        span.setAttributes({
          user_agent: event.headers?.["user-agent"] || "unknown",
          client_ip:
            event.headers?.["client-ip"] ||
            event.headers?.["x-forwarded-for"] ||
            "unknown",
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
          span.setAttributes({ "http.status_code": 500 });
          
          // Record the request metric with error status
          recordRequest(500);

          // Add error event
          span.addEvent("function.error", {
            "error.type": "random_error",
            "error.message": "Random error occurred",
          });

          // Record exception
          const error = new Error("netlify-ts hello error");
          span.recordException(error);

          throw error;
        }

        // Success case
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({ "http.status_code": 200 });
        
        // Record the request metric with success status
        recordRequest(200);

        // Add success event
        span.addEvent("function.success", {
          "response.message": "netlify-ts hello success",
        });

        const message = "netlify-ts hello success";

        return {
          statusCode: 200,
          body: message,
          headers: {
            "Content-Type": "text/plain",
            "X-Trace-Id": span.spanContext().traceId,
          },
        };
      } catch (error) {
        // Handle errors and update span
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.setAttributes({ "http.status_code": 500 });
        
        // Record the request metric with error status
        recordRequest(500);

        if (error instanceof Error) {
          span.recordException(error);
        }

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
