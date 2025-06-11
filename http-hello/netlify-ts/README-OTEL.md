# OpenTelemetry Instrumentation for Netlify TypeScript Functions

This project includes OpenTelemetry (OTEL) instrumentation that automatically traces your Netlify Functions and sends telemetry data to any OTLP-compatible endpoint.

## 🚀 Features

- **Automatic tracing** of function executions
- **Custom spans** with detailed attributes
- **Error tracking** with exception recording
- **Environment-based configuration** using standard OTEL environment variables
- **OTLP HTTP export** to any compatible backend

## 📋 Configuration

Set the following environment variables to configure OpenTelemetry:

### Required
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### Optional
```bash
OTEL_SERVICE_NAME=netlify-ts-functions
OTEL_SERVICE_VERSION=1.0.0
NODE_ENV=development
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

### Honeycomb
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=YOUR_API_KEY
```

### New Relic
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net
OTEL_EXPORTER_OTLP_HEADERS=api-key=YOUR_LICENSE_KEY
```

### Datadog
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.datadoghq.com
OTEL_EXPORTER_OTLP_HEADERS=DD-API-KEY=YOUR_API_KEY
```

### Grafana Cloud
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic YOUR_BASE64_ENCODED_CREDENTIALS
```

## 📊 What Gets Traced

The instrumentation automatically captures:

- **Function execution spans** with timing
- **HTTP request details** (method, path, user agent)
- **Function-specific attributes** (name, version, request ID)
- **Custom events** (function start, success, errors)
- **Random number generation** (for demo purposes)
- **Error details** with stack traces
- **Trace IDs** in response headers

## 🧪 Testing Locally

1. **Start a local OTLP receiver** (e.g., Jaeger):
   ```bash
   docker run -d --name jaeger \
     -p 16686:16686 \
     -p 4317:4317 \
     -p 4318:4318 \
     jaegertracing/all-in-one:latest
   ```

2. **Set environment variables**:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   export OTEL_SERVICE_NAME=netlify-ts-functions
   ```

3. **Run the function**:
   ```bash
   npm run dev
   ```

4. **Make requests**:
   ```bash
   curl http://localhost:PORT/hello
   ```

5. **View traces** in Jaeger UI: http://localhost:16686

## 🔍 Trace Details

Each function execution creates a span with:

- **Span name**: `hello-function`
- **Attributes**:
  - `function.name`: Function identifier
  - `http.method`: HTTP method
  - `http.path`: Request path
  - `user_agent`: Client user agent
  - `request.id`: Unique request ID
  - `random.number`: Generated random number
  - `cloud.provider`: "netlify"
  - `service.name`: "netlify-functions"

- **Events**:
  - `function.start`: When function begins
  - `function.success`: On successful completion
  - `function.error`: On error (with error details)

- **Response Headers**:
  - `X-Trace-Id`: OpenTelemetry trace ID for correlation

## 🚨 Error Handling

The function randomly generates errors (1 in 9 chance) to demonstrate error tracing:

- **Error spans** are marked with `ERROR` status
- **Exception details** are recorded in the span
- **Error events** include error type and message
- **HTTP 500** responses are returned for errors

## 📁 File Structure

```
src/
├── otel.ts              # OTEL initialization
├── telemetry.ts         # Telemetry utilities
└── functions/
    └── hello.ts         # Instrumented function
```

## 🔧 Customization

To add instrumentation to other functions:

1. **Import the utilities**:
   ```typescript
   import { initializeOtel } from "../otel";
   import { FunctionTelemetry } from "../telemetry";
   ```

2. **Initialize OTEL** (once per function):
   ```typescript
   let otelInitialized = false;
   if (!otelInitialized) {
     initializeOtel();
     otelInitialized = true;
   }
   ```

3. **Wrap your function logic**:
   ```typescript
   return FunctionTelemetry.executeWithSpan("your-function-name", async (span) => {
     // Your function logic here
     FunctionTelemetry.addAttributes({ "custom.attribute": "value" });
     FunctionTelemetry.addEvent("custom.event", { "detail": "info" });
     
     return { statusCode: 200, body: "success" };
   });
   ```

## 🎯 Production Deployment

For production, set the environment variables in your Netlify site settings or use a `.env` file that gets deployed with your functions.

The instrumentation will only activate when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, so it's safe to deploy without affecting performance when OTEL is not configured.
