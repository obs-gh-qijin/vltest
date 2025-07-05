# OpenTelemetry Instrumentation for Netlify TypeScript Functions

This project includes comprehensive OpenTelemetry (OTEL) instrumentation that automatically traces your Netlify Functions and sends telemetry data to Observe and other OTLP-compatible endpoints.

## 🚀 Features

- **Automatic tracing** of function executions with detailed spans using OpenTelemetry semantic conventions
- **Comprehensive metrics collection** including request counts, error rates, duration histograms, and active connections
- **Structured logging** with automatic trace correlation (trace/span IDs in logs)
- **Enhanced error tracking** with exception recording, error events, and detailed error context
- **Success/failure events** with custom attributes and business metrics
- **Trace and Span IDs** included in response headers for request correlation
- **Resource attributes** following OpenTelemetry semantic conventions for cloud environments
- **Environment-based configuration** using standard OTEL environment variables
- **OTLP HTTP export** for both traces and metrics to any compatible backend
- **Performance optimized** with proper cleanup and graceful shutdown

## 📋 Configuration

Set the following environment variables to configure OpenTelemetry:

### Required for Observe

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://collect.observeinc.com
OBSERVE_INGEST_TOKEN=your_observe_ingest_token_here
```

### Optional

```bash
OTEL_SERVICE_NAME=netlify-ts-functions
OTEL_SERVICE_VERSION=1.0.0
NODE_ENV=production
```

### For Other OTLP Backends

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-endpoint.com
OBSERVE_INGEST_TOKEN=your_token_or_api_key
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

## 📊 What Gets Traced and Measured

### Distributed Tracing
- **Function execution spans** with timing and status using OpenTelemetry semantic conventions
- **HTTP request details** (method, route, URL, user agent, client IP)
- **Function-specific attributes** (name, cloud provider, request ID, memory limits)
- **Resource attributes** (service name, version, cloud provider, environment)
- **Custom events** (function start, success, errors with timestamps)
- **Error details** with stack traces and exception recording
- **Trace and Span IDs** in response headers for request correlation

### Metrics Collection
- **`http.server.requests`** - Counter of HTTP requests by status code and status class
- **`http.server.request_duration`** - Histogram of request durations in milliseconds
- **`http.server.errors`** - Counter of HTTP errors by status code
- **`http.server.active_connections`** - Gauge of active HTTP connections

### Structured Logging
- **JSON-formatted logs** with automatic trace correlation
- **Log levels** (debug, info, warn, error) with proper severity mapping
- **Trace/Span IDs** automatically included in every log entry
- **Contextual attributes** including request ID, function name, and custom business data
- **Automatic span events** for all log entries

## 🧪 Testing Locally

1. Start a local OTLP collector (e.g., Jaeger):

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

2. Set environment variables:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=netlify-ts-functions
```

3. Run your Netlify function:

```bash
pnpm run dev
```

4. Visit http://localhost:16686 to view traces in Jaeger UI

## 📁 File Structure

- `src/functions/otel.ts` - Enhanced OpenTelemetry configuration with metrics and proper environment handling
- `src/functions/logger.ts` - Structured logging utility with automatic trace correlation
- `src/functions/hello.ts` - Fully instrumented Netlify function with tracing, metrics, and logging
- `netlify.toml` - Environment configuration for deployment with Observe integration
- `package.json` - All required OpenTelemetry dependencies

## 🏗️ Implementation Details

### OpenTelemetry Setup (`otel.ts`)
- Proper resource configuration with semantic attributes
- Separate exporters for traces and metrics
- Periodic metric export (30-second intervals)
- Graceful shutdown handling
- Environment variable validation

### Structured Logging (`logger.ts`)
- JSON-formatted log output
- Automatic trace/span ID injection
- Multiple log levels with proper mapping
- Span event creation for log correlation
- Configurable service information

### Function Instrumentation (`hello.ts`)
- Comprehensive span creation with semantic attributes
- Request timing and performance metrics
- Active connection tracking
- Enhanced error handling and reporting
- Response header injection for trace correlation
- Business logic observability
