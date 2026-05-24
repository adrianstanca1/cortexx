const assert = require('assert');
const client = require('../lib/unified-ai-client-v2');

async function runExpandedTests() {
    console.log('Running expanded integration tests for v2...');
    
    // 1. Interface contract
    assert(typeof client.queryOllama === 'function', 'queryOllama missing');
    assert(typeof client.queryGemini === 'function', 'queryGemini missing');
    assert(typeof client.queryOpenRouter === 'function', 'queryOpenRouter missing');
    assert(typeof client.getEmbedding === 'function', 'getEmbedding missing');
    assert(typeof client.healthCheck === 'function', 'healthCheck missing');
    assert(typeof client.smartQuery === 'function', 'smartQuery missing');
    
    // 2. Mocking response structure test
    // For now, testing the contract
    const embedding = await client.getEmbedding('test');
    assert(Array.isArray(embedding), 'Embedding contract failed');
    assert(embedding.length > 0, 'Embedding array empty');
    
    // 3. Health check returns expected structure
    const health = await client.healthCheck();
    assert(typeof health === 'object', 'Health check should return object');
    assert(health.timestamp, 'Health check should have timestamp');
    assert(health.providers, 'Health check should have providers');
    assert(health.overall, 'Health check should have overall status');
    
    console.log('✅ Integration tests passed for v2');
}

runExpandedTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
