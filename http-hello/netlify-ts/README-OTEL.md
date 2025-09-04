# Comprehensive OpenTelemetry Instrumentation for Netlify TypeScript Functions

This project includes comprehensive OpenTelemetry (OTEL) instrumentation that automatically traces your Netlify Functions, collects metrics, and provides structured logging with full observability.

## 🚀 Features

### Tracing
- **Automatic distributed tracing** with proper span lifecycle management
- **Semantic conventions compliance** for HTTP attributes
- **Auto-instrumentation** for HTTP/HTTPS, DNS, and file system operations
- **Custom spans** for function execution with detailed attributes
- **Error tracking** with exception recording and error events
- **Trace and span IDs** included in response headers for correlation

### Metrics
- **HTTP request counters** with status code and method dimensions
- **Request duration histograms** for latency analysis
- **Active request counters** for real-time monitoring
- **Function execution time** and invocation counters
- **Error rate tracking** with error type classification
- **Periodic metric export** to OTLP-compatible backends

### Logging
- **Structured JSON logging** with trace correlation
- **Automatic trace and span ID injection** into all log entries
- **Contextual logging** with request details and performance metrics
- **Error logging** with stack traces and structured error information
- **Multiple log levels** (info, warn, error) with proper formatting

### Configuration
- **Environment-based configuration** using standard OTEL environment variables
- **Resource attributes** with service information, cloud provider, and runtime details
- **Automatic environment detection** (development, staging, production)
- **Comprehensive instrumentation** with selective enablement
- **OTLP HTTP export** to any compatible backend

## 📋 Configuration

### Required Environment Variables

```bash
# Main OTLP endpoint (without /v1/traces or /v1/metrics suffix)
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-endpoint.com/v2/otel

# Bearer token for OTLP authentication (standard OpenTelemetry variable)
OTEL_EXPORTER_OTLP_BEARER_TOKEN=your_bearer_token_here

# Alternative token variables (for Observe specifically):
OBSERVE_INGEST_TOKEN=your_observe_ingest_token_here
```

### Optional Environment Variables

```bash
# Service identification
OTEL_SERVICE_NAME=netlify-ts-functions
OTEL_SERVICE_VERSION=1.0.0
OTEL_DEPLOYMENT_ENVIRONMENT=production

# Standard OpenTelemetry bearer token
OTEL_EXPORTER_OTLP_BEARER_TOKEN=your_bearer_token_here

# Alternative token variable names (fallback)
OBSERVE_TOKEN=your_observe_ingest_token_here

# Node.js environment (used for environment detection)
NODE_ENV=production
```

### Netlify Environment Configuration

In your `netlify.toml` file:

```toml
[build.environment]
  OTEL_EXPORTER_OTLP_ENDPOINT = "https://your-tenant.collect.observeinc.com/v2/otel"
  OTEL_SERVICE_NAME = "netlify-ts-functions"
  OTEL_SERVICE_VERSION = "1.0.0"
  OTEL_DEPLOYMENT_ENVIRONMENT = "production"
  OBSERVE_INGEST_TOKEN = "your_observe_ingest_token_here"
```

## 🔧 Supported OTLP Backends

The instrumentation works with any OTLP-compatible backend:

### Jaeger

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### Zipkin

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:9411
```

### Observe

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-tenant.collect.observeinc.com/v2/otel
OTEL_EXPORTER_OTLP_HEADERS='{"Authorization":"Bearer your_observe_ingest_token_here","x-observe-target-package":"Tracing"}'
```

### Honeycomb

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS='{"x-honeycomb-team":"YOUR_API_KEY"}'
```

### New Relic

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net
OTEL_EXPORTER_OTLP_HEADERS='{"api-key":"YOUR_LICENSE_KEY"}'
```

## 📊 What Gets Instrumented

### Automatic Tracing
- **Function execution spans** with complete lifecycle (start, end, duration)
- **HTTP/HTTPS outgoing requests** with request/response details
- **DNS lookups** for external service dependencies
- **File system operations** for debugging and performance analysis
- **Error spans** with proper status codes and exception details

### Semantic Attributes
- **HTTP attributes** following OpenTelemetry semantic conventions
- **Cloud provider metadata** (Netlify, AWS Lambda context)
- **Function metadata** (name, version, runtime, cold start detection)
- **Request context** (method, route, user agent, client IP, request ID)
- **Error context** (error type, message, stack trace)
- **Performance metrics** (execution time, random demo values)

### Comprehensive Metrics
- **Request counters** by status code, method, and error type
- **Request duration histograms** for latency percentiles
- **Active request gauges** for real-time monitoring
- **Function invocation counters** with success/failure rates
- **Error rate metrics** with classification and trends

### Structured Logging
- **JSON-formatted logs** with consistent structure
- **Trace correlation** with automatic trace/span ID injection
- **Request lifecycle logging** (start, success, error, completion)
- **Performance logging** with execution duration and metrics
- **Error logging** with full context and stack traces
- **Contextual attributes** for filtering and analysis

## 🧪 Testing Locally

### 1. Start a local OTLP collector (e.g., Jaeger with metrics support):

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

### 2. Set environment variables:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=netlify-ts-functions
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_DEPLOYMENT_ENVIRONMENT=development
export NODE_ENV=development
```

### 3. Install dependencies:

```bash
pnpm install
```

### 4. Build the project:

```bash
pnpm run build
```

### 5. Run your Netlify function:

```bash
pnpm run dev
```

### 6. Test the function:

```bash
curl http://localhost:8888/hello
```

### 7. View observability data:
- **Traces**: Visit http://localhost:16686 to view traces in Jaeger UI
- **Logs**: Check the console output for structured JSON logs
- **Metrics**: Available through Jaeger's metrics integration

## 🔍 Observability Data Examples

### Trace Example
```json
{
  "traceId": "abc123...",
  "spanId": "def456...",
  "name": "hello-function",
  "kind": "SERVER",
  "status": "OK",
  "attributes": {
    "http.request.method": "GET",
    "http.route": "/hello",
    "http.response.status_code": 200,
    "user_agent.original": "curl/7.68.0",
    "client.address": "127.0.0.1",
    "function.name": "hello",
    "cloud.provider": "netlify",
    "random.number": 5
  }
}
```

### Log Example
```json
{
  "level": "info",
  "message": "Function execution completed successfully",
  "service": "netlify-ts-functions",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "traceId": "abc123...",
  "spanId": "def456...",
  "randomNumber": 5,
  "statusCode": 200,
  "duration": 45,
  "responseMessage": "netlify-ts hello success"
}
```

### Metrics Example
```
http.server.requests{http.status_code="200",service.name="netlify-ts-functions"} 1
http.server.request.duration{http.status_code="200",service.name="netlify-ts-functions"} 45
function.invocations{function.name="hello",service.name="netlify-ts-functions"} 1
```

## 📁 File Structure

- `src/functions/otel.ts` - Comprehensive OpenTelemetry configuration and initialization
- `src/functions/hello.ts` - Fully instrumented Netlify function with tracing, metrics, and logging
- `netlify.toml` - Environment configuration for deployment
- `package.json` - Dependencies including all OpenTelemetry instrumentation packages
- `tsconfig.json` - TypeScript configuration optimized for Netlify Functions

## 🔧 Technical Implementation

### OpenTelemetry SDK Configuration
- **NodeSDK** with comprehensive resource attributes
- **BatchSpanProcessor** for efficient trace export
- **PeriodicExportingMetricReader** for regular metrics export
- **Auto-instrumentations** for common Node.js libraries
- **Custom instrumentations** for HTTP, HTTPS, DNS, and file system

### Metrics Collection
- **Counters** for request counts, invocations, and errors
- **Histograms** for request duration and execution time
- **UpDownCounters** for active request tracking
- **Dimensional attributes** for filtering and aggregation

### Error Handling
- **Proper span status** with error codes and messages
- **Exception recording** with stack traces
- **Error events** with contextual information
- **Structured error logging** with correlation IDs

### Performance Optimization
- **Efficient span lifecycle** management
- **Batch processing** for traces and metrics
- **Selective instrumentation** to minimize overhead
- **Diagnostic logging** for development debugging
