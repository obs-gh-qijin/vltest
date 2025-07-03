# OpenTelemetry Instrumentation for Netlify TypeScript Functions

This project includes OpenTelemetry (OTEL) instrumentation that automatically traces your Netlify Functions and sends telemetry data to any OTLP-compatible endpoint.

## 🚀 Features

- **Comprehensive auto-instrumentation** for HTTP, DNS, and network operations
- **Advanced metrics collection** including request duration, active requests, and error rates
- **Structured JSON logging** with automatic trace correlation
- **Detailed tracing** of function executions with rich span attributes
- **Custom attributes** including HTTP method, route, user agent, client IP, and semantic conventions
- **Error tracking** with exception recording, error events, and structured error logs
- **Performance monitoring** with request latency histograms and throughput counters
- **Success/failure events** with custom attributes and timing information
- **Trace and Span IDs** included in response headers for correlation
- **Environment-based configuration** using standard OTEL environment variables
- **Resource attributes** with cloud provider, platform, and service information
- **OTLP HTTP export** for both traces and metrics to any compatible backend

## 📋 Configuration

Set the following environment variables to configure OpenTelemetry:

### Required

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-endpoint.com/v2/otel
OBSERVE_INGEST_TOKEN=your_observe_ingest_token_here
```

### Optional

```bash
OTEL_SERVICE_NAME=netlify-ts-functions
OTEL_SERVICE_VERSION=1.0.0
OTEL_DEPLOYMENT_ENVIRONMENT=production
OTEL_EXPORTER_OTLP_HEADERS='{"Authorization":"Bearer YOUR_TOKEN","x-observe-target-package":"Tracing"}'
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
OBSERVE_INGEST_TOKEN=your_observe_ingest_token_here
# Headers are automatically configured when using OBSERVE_INGEST_TOKEN
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

## 📊 What Gets Traced & Logged

The instrumentation automatically captures:

### Tracing
- **Function execution spans** with timing and status
- **Auto-instrumented HTTP requests** with detailed attributes
- **DNS and network operations** (auto-instrumented)
- **HTTP request details** (method, route, user agent, client IP)
- **Function-specific attributes** (name, cloud provider, request ID, execution ID)
- **Resource attributes** (service name, version, environment, cloud platform)
- **Custom events** (function start, success, errors) with timestamps
- **Random number generation** (for demo purposes)
- **Error details** with stack traces and exception recording
- **Trace and Span IDs** in response headers for request correlation

### Metrics
- **HTTP request counter** with status codes and classes
- **Request duration histogram** for latency analysis
- **Active requests gauge** for concurrency monitoring
- **Error counter** for error rate tracking
- **Custom business metrics** as needed

### Structured Logging
- **JSON-formatted logs** with trace correlation
- **Function lifecycle events** (start, success, error)
- **Request details** with timing and metadata
- **Error logs** with stack traces and context
- **Automatic trace/span ID injection** for log correlation

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
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_DEPLOYMENT_ENVIRONMENT=local
```

3. Run your Netlify function:

```bash
pnpm run dev
```

4. Visit http://localhost:16686 to view traces in Jaeger UI

## 📁 File Structure

- `src/functions/otel.ts` - OpenTelemetry configuration and initialization with metrics
- `src/functions/logger.ts` - Structured logging with trace correlation
- `src/functions/hello.ts` - Instrumented Netlify function with comprehensive observability
- `netlify.toml` - Environment configuration for deployment
- `package.json` - Dependencies including auto-instrumentation packages

## 🔧 Key Improvements

- **Enhanced Metrics**: Added request duration, active requests, and error counters
- **Structured Logging**: JSON logs with automatic trace correlation
- **Resource Attributes**: Comprehensive service and cloud metadata
- **Auto-instrumentation**: HTTP, DNS, and network operations automatically traced
- **Better Error Handling**: Structured error logging and detailed exception recording
- **Performance Monitoring**: Request timing and duration tracking
- **Environment Variables**: Support for OBSERVE_INGEST_TOKEN and better configuration
