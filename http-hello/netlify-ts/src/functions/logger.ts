import { trace, context, SpanContext } from "@opentelemetry/api";

// Log levels
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Logger class with OpenTelemetry integration
class Logger {
  private serviceName: string;
  private serviceVersion: string;
  private environment: string;

  constructor(
    serviceName: string = "netlify-ts-functions",
    serviceVersion: string = "1.0.0",
    environment: string = "development"
  ) {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
    this.environment = environment;
  }

  private getTraceContext(): { traceId?: string; spanId?: string } {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return {};
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    attributes?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const { traceId, spanId } = this.getTraceContext();
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.serviceVersion,
      environment: this.environment,
      traceId,
      spanId,
      attributes,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return logEntry;
  }

  private log(level: LogLevel, message: string, attributes?: Record<string, any>, error?: Error): void {
    const logEntry = this.createLogEntry(level, message, attributes, error);
    
    // Output structured JSON logs
    console.log(JSON.stringify(logEntry));
    
    // Also add log event to current span if available
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(`log.${level}`, {
        "log.message": message,
        "log.level": level,
        ...attributes,
      });
    }
  }

  debug(message: string, attributes?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, attributes);
  }

  info(message: string, attributes?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, attributes);
  }

  warn(message: string, attributes?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, attributes);
  }

  error(message: string, error?: Error, attributes?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, attributes, error);
  }

  // Method to log with custom trace context
  logWithContext(
    level: LogLevel,
    message: string,
    spanContext: SpanContext,
    attributes?: Record<string, any>,
    error?: Error
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.serviceVersion,
      environment: this.environment,
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      attributes,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    console.log(JSON.stringify(logEntry));
  }
}

// Export a default logger instance
export const logger = new Logger(
  process.env.OTEL_SERVICE_NAME || "netlify-ts-functions",
  process.env.OTEL_SERVICE_VERSION || "1.0.0",
  process.env.OTEL_DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || "development"
);

// Export the Logger class for custom instances
export { Logger };