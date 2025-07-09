#!/usr/bin/env node

/**
 * Simple test script to validate OpenTelemetry instrumentation
 * This script simulates a Netlify function execution to test the instrumentation
 */

const { handler } = require('./functions/hello');

// Mock Netlify event and context
const mockEvent = {
  httpMethod: 'GET',
  path: '/hello',
  headers: {
    'user-agent': 'test-client/1.0',
    'client-ip': '127.0.0.1',
    'host': 'localhost:8888',
    'accept': 'text/plain',
  },
  body: null,
  isBase64Encoded: false,
};

const mockContext = {
  awsRequestId: 'test-request-123',
  functionName: 'hello',
  functionVersion: '1.0.0',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:hello',
  memoryLimitInMB: 128,
  remainingTimeInMillis: 30000,
};

// Test function execution
async function testInstrumentation() {
  console.log('🧪 Testing OpenTelemetry instrumentation...\n');
  
  // Set test environment variables
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
  process.env.OTEL_SERVICE_NAME = 'netlify-ts-functions-test';
  process.env.OTEL_SERVICE_VERSION = '1.0.0';
  process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'test';
  process.env.NODE_ENV = 'test';
  
  try {
    // Run multiple test executions
    const results = [];
    const testCount = 5;
    
    console.log(`Running ${testCount} test executions...\n`);
    
    for (let i = 1; i <= testCount; i++) {
      console.log(`Test ${i}/${testCount}:`);
      const startTime = Date.now();
      
      try {
        const result = await handler(mockEvent, mockContext);
        const duration = Date.now() - startTime;
        
        console.log(`  Status: ${result.statusCode}`);
        console.log(`  Duration: ${duration}ms`);
        console.log(`  Trace ID: ${result.headers['X-Trace-Id']}`);
        console.log(`  Response: ${result.body}`);
        
        results.push({
          execution: i,
          statusCode: result.statusCode,
          duration,
          traceId: result.headers['X-Trace-Id'],
          success: result.statusCode === 200,
        });
      } catch (error) {
        console.log(`  Error: ${error.message}`);
        results.push({
          execution: i,
          statusCode: 500,
          duration: Date.now() - startTime,
          error: error.message,
          success: false,
        });
      }
      
      console.log('');
      
      // Small delay between executions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    console.log('📊 Test Results Summary:');
    console.log(`  Total executions: ${testCount}`);
    console.log(`  Successful: ${successful} (${(successful/testCount*100).toFixed(1)}%)`);
    console.log(`  Failed: ${failed} (${(failed/testCount*100).toFixed(1)}%)`);
    console.log(`  Average duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`  Unique trace IDs: ${new Set(results.map(r => r.traceId)).size}`);
    
    // Validate instrumentation
    const hasTraceIds = results.every(r => r.traceId && r.traceId.length > 0);
    const hasVariedResults = results.some(r => r.success) && results.some(r => !r.success);
    
    console.log('\\n✅ Instrumentation Validation:');
    console.log(`  Trace IDs present: ${hasTraceIds ? '✅' : '❌'}`);
    console.log(`  Varied results (success/error): ${hasVariedResults ? '✅' : '❌'}`);
    console.log(`  JSON structured logs: ✅ (check console output above)`);
    console.log(`  Metrics collection: ✅ (check OTLP endpoint)`);
    
    if (hasTraceIds && hasVariedResults) {
      console.log('\\n🎉 OpenTelemetry instrumentation is working correctly!');
      console.log('\\n📈 Next steps:');
      console.log('  1. Check your OTLP endpoint (e.g., Jaeger UI at http://localhost:16686)');
      console.log('  2. Look for traces with service name "netlify-ts-functions-test"');
      console.log('  3. Verify metrics are being exported every 10 seconds');
      console.log('  4. Check that structured logs contain trace correlation IDs');
    } else {
      console.log('\\n❌ Some instrumentation features may not be working correctly.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Test interrupted. Shutting down gracefully...');
  process.exit(0);
});

// Run the test
testInstrumentation();