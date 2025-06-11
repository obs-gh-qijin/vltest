import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";

// Get tracer instance
const tracer = trace.getTracer('netlify-functions', '1.0.0');

// Simple telemetry utilities
export class FunctionTelemetry {
  /**
   * Create a span for a function execution
   */
  static async executeWithSpan<T>(
    spanName: string,
    operation: (span: any) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    return tracer.startActiveSpan(spanName, { kind: SpanKind.SERVER }, async (span) => {
      try {
        // Add default attributes
        span.setAttributes({
          'function.name': spanName,
          'cloud.provider': 'netlify',
          'service.name': 'netlify-functions',
          ...attributes,
        });

        // Execute the operation
        const result = await operation(span);
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        // Set span status and record exception
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Add custom attributes to the current span
   */
  static addAttributes(attributes: Record<string, string | number | boolean>) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Add an event to the current span
   */
  static addEvent(name: string, attributes?: Record<string, string | number | boolean>) {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }
}

// Export individual utilities for convenience
export const { executeWithSpan, addAttributes, addEvent } = FunctionTelemetry;
