import { Handler } from "@netlify/functions";
import { trace, SpanStatusCode, SpanKind, context } from "@opentelemetry/api";
import { ATTR_HTTP_REQUEST_METHOD, ATTR_HTTP_ROUTE, ATTR_HTTP_RESPONSE_STATUS_CODE, ATTR_USER_AGENT_ORIGINAL, ATTR_CLIENT_ADDRESS } from "@opentelemetry/semantic-conventions";
import { initializeOtel, recordRequest, trackActiveRequest } from "./otel";

// Initialize OpenTelemetry (only once)
if (!global.otelInitialized) {
  initializeOtel();
  global.otelInitialized = true;
}

// Get tracer instance
const tracer = trace.getTracer("netlify-functions", "1.0.0");

// Structured logging with trace correlation
const createLogger = (traceId?: string, spanId?: string) => {
  const baseContext = {
    service: "netlify-ts-functions",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    ...(traceId && { traceId }),
    ...(spanId && { spanId }),
  };

  return {
    info: (message: string, attributes?: Record<string, any>) => {
      console.log(JSON.stringify({ level: "info", message, ...baseContext, ...attributes }));
    },
    warn: (message: string, attributes?: Record<string, any>) => {
      console.warn(JSON.stringify({ level: "warn", message, ...baseContext, ...attributes }));
    },
    error: (message: string, error?: Error | any, attributes?: Record<string, any>) => {
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

const handler: Handler = async (event, context) => {
  const startTime = Date.now();
  
  // Track active request
  trackActiveRequest(true);
  
  // Create a span for the function execution with semantic conventions
  return tracer.startActiveSpan(
    "hello-function",
    {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: event.httpMethod || "GET",
        [ATTR_HTTP_ROUTE]: "/hello",
        "function.name": "hello",
        "cloud.provider": "netlify",
        "cloud.platform": "netlify_functions",
        "faas.name": "hello",
        "faas.trigger": "http",
        "request.id": context.awsRequestId || "unknown",
        "netlify.request_id": context.awsRequestId || "unknown",
      },
    },
    async (span) => {
      const spanContext = span.spanContext();
      const logger = createLogger(spanContext.traceId, spanContext.spanId);
      
      try {
        // Add additional semantic attributes
        const userAgent = event.headers?.["user-agent"] || "unknown";
        const clientIp = event.headers?.["client-ip"] || event.headers?.["x-forwarded-for"] || "unknown";
        
        span.setAttributes({
          [ATTR_USER_AGENT_ORIGINAL]: userAgent,
          [ATTR_CLIENT_ADDRESS]: clientIp,
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
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          span.setAttributes({ 
            [ATTR_HTTP_RESPONSE_STATUS_CODE]: 500,
            "error.type": "random_error",
            "error.message": errorMessage,
          });
          
          // Calculate duration and record metrics
          const duration = Date.now() - startTime;
          recordRequest(500, duration, {
            "http.method": event.httpMethod || "GET",
            "error.type": "random_error",
          });

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
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({ [ATTR_HTTP_RESPONSE_STATUS_CODE]: 200 });
        
        // Calculate duration and record metrics
        const duration = Date.now() - startTime;
        recordRequest(200, duration, {
          "http.method": event.httpMethod || "GET",
        });

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
      } catch (error) {
        // Handle errors and update span
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });
        span.setAttributes({ 
          [ATTR_HTTP_RESPONSE_STATUS_CODE]: 500,
          "error.type": "unhandled_error",
        });
        
        // Calculate duration and record metrics
        const duration = Date.now() - startTime;
        recordRequest(500, duration, {
          "http.method": event.httpMethod || "GET",
          "error.type": "unhandled_error",
        });

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
