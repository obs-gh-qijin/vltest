import { Handler } from "@netlify/functions";
import { initializeOtel } from "../otel";
import { FunctionTelemetry } from "../telemetry";

// Initialize OpenTelemetry (only once)
let otelInitialized = false;
if (!otelInitialized) {
  initializeOtel();
  otelInitialized = true;
}

const handler: Handler = async (event, context) => {
  return FunctionTelemetry.executeWithSpan("hello-function", async (span) => {
    // Add function-specific attributes
    FunctionTelemetry.addAttributes({
      "function.name": "hello",
      "http.method": event.httpMethod || "GET",
      "http.path": event.path || "/hello",
      user_agent: event.headers?.["user-agent"] || "unknown",
      "request.id": context.awsRequestId || "unknown",
    });

    // Generate a random number between 1 and 9
    const randomNumber = Math.floor(Math.random() * 9) + 1;

    // Add the random number as an attribute
    FunctionTelemetry.addAttributes({
      "random.number": randomNumber,
    });

    // If the random number is 1, return an error message (1 out of 9 times)
    const isError = randomNumber === 1;

    if (isError) {
      // Add error event
      FunctionTelemetry.addEvent("function.error", {
        "error.type": "random_error",
        "error.message": "Random error occurred",
      });

      // Throw an error to trigger error handling in telemetry
      throw new Error("netlify-ts hello error");
    }

    // Add success event
    FunctionTelemetry.addEvent("function.success", {
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
  }).catch((error) => {
    // Handle errors and return appropriate response
    return {
      statusCode: 500,
      body: error.message,
      headers: {
        "Content-Type": "text/plain",
      },
    };
  });
};

export { handler };
