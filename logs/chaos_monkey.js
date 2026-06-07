const http = require('http');
const https = require('https');

const TARGET = 'https://api.cortexbuildpro.com/api/health';
let requests = 0;
let errors = 0;

setInterval(() => {
  https.get(TARGET, (res) => {
    requests++;
    if (res.statusCode !== 200 && res.statusCode !== 401) {
      errors++;
      console.log(`[Chaos] Anomaly detected: Status ${res.statusCode}`);
    }
  }).on('error', (e) => {
    errors++;
    console.log(`[Chaos] Request error: ${e.message}`);
  });
  
  if (requests % 100 === 0) {
    console.log(`[Chaos] Sent ${requests} requests. Errors: ${errors}`);
  }
}, 50); // Aggressive hammering
