const http = require('http');

// Simple test to verify API endpoints are accessible
const testEndpoints = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api' },
  { method: 'GET', path: '/api/auth/status' },
  { method: 'GET', path: '/api/cart' },
  { method: 'GET', path: '/api/wishlist' },
  { method: 'GET', path: '/api/notifications' },
  { method: 'GET', path: '/api/status/online/users' }
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          endpoint: `${endpoint.method} ${endpoint.path}`,
          status: res.statusCode,
          success: res.statusCode < 500
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        status: 'ERROR',
        success: false,
        error: err.message
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing API endpoints...\n');
  
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.endpoint} - Status: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('\nAPI endpoint test completed!');
}

runTests().catch(console.error);