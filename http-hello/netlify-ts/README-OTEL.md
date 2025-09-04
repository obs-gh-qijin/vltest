# OpenTelemetry Instrumentation for Netlify TypeScript Functions

This project includes OpenTelemetry (OTEL) instrumentation that automatically traces your Netlify Functions and sends telemetry data to any OTLP-compatible endpoint.

## 🚀 Features

- **Automatic tracing** of function executions with detailed spans
- **Semantic conventions** for HTTP attributes following OpenTelemetry standards
- **Structured logging** with trace correlation and JSON output
- **Comprehensive metrics** including request counts and duration histograms
- **Error tracking** with exception recording and error events
- **Success/failure events** with custom attributes
- **Trace ID** included in response headers for correlation
- **Environment-based configuration** using standard OTEL environment variables
- **OTLP HTTP export** to any compatible backend

## 📋 Configuration

Set the following environment variables to configure OpenTelemetry:

### Required

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-endpoint.com
OTEL_EXPORTER_OTLP_BEARER_TOKEN=your_bearer_token_here
```

### Optional

```bash
OTEL_SERVICE_NAME=netlify-ts-functions
OTEL_SERVICE_VERSION=1.0.0
```

**Note**: The instrumentation automatically appends `/v1/traces` and `/v1/metrics` to the endpoint URL for the respective exporters.

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

## 📊 What Gets Traced

The instrumentation automatically captures:

- **Function execution spans** with timing and status using semantic conventions
- **HTTP request details** (method, route, user agent, client IP) following OpenTelemetry standards
- **Function-specific attributes** (name, cloud provider, request ID, FaaS attributes)
- **Custom events** (function start, success, errors)
- **Random number generation** (for demo purposes)
- **Error details** with stack traces and exception recording
- **Trace IDs** in response headers for request correlation
- **Structured logs** with trace correlation in JSON format
- **Metrics** including request counts and duration histograms with status code labels

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

- `src/functions/otel.ts` - OpenTelemetry configuration and initialization
- `src/functions/hello.ts` - Instrumented Netlify function
- `netlify.toml` - Environment configuration for deployment
