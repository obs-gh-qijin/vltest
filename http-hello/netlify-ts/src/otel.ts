// Simple OTEL setup using environment variables
export const initializeOtel = () => {
  // Check if OTEL endpoint is configured
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  
  if (!otelEndpoint) {
    console.log('OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping OpenTelemetry initialization');
    return null;
  }

  try {
    // Use the standard OTEL environment variables for configuration
    // This will automatically configure the SDK based on env vars
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    
    const sdk = new NodeSDK({
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
    
    console.log('OpenTelemetry initialized successfully');
    console.log(`OTLP Endpoint: ${otelEndpoint}`);
    console.log(`Service Name: ${process.env.OTEL_SERVICE_NAME || 'netlify-ts-functions'}`);
    
    return sdk;
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
    return null;
  }
};
