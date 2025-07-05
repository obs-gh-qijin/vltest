import { trace, context } from "@opentelemetry/api";

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  service: string;
  version: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, any>;
}

export class StructuredLogger {
  private serviceName: string;
  private serviceVersion: string;

  constructor(serviceName: string = "netlify-functions", serviceVersion: string = "1.0.0") {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
  }

  private createLogEntry(level: LogEntry['level'], message: string, attributes?: Record<string, any>): LogEntry {
    const activeSpan = trace.getActiveSpan();
    const spanContext = activeSpan?.spanContext();
    
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      version: this.serviceVersion,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      attributes,
    };
  }

  private log(entry: LogEntry): void {
    // For structured logging, we output JSON
    console.log(JSON.stringify(entry));
  }

  debug(message: string, attributes?: Record<string, any>): void {
    this.log(this.createLogEntry('debug', message, attributes));
  }

  info(message: string, attributes?: Record<string, any>): void {
    this.log(this.createLogEntry('info', message, attributes));
  }

  warn(message: string, attributes?: Record<string, any>): void {
    this.log(this.createLogEntry('warn', message, attributes));
  }

  error(message: string, attributes?: Record<string, any>): void {
    this.log(this.createLogEntry('error', message, attributes));
  }

  // Method to log with context from current span
  logWithSpan(level: LogEntry['level'], message: string, attributes?: Record<string, any>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      // Add span event as well
      activeSpan.addEvent(`log.${level}`, {
        message,
        ...attributes,
      });
    }
    
    this.log(this.createLogEntry(level, message, attributes));
  }
}

// Export a default logger instance
export const logger = new StructuredLogger();