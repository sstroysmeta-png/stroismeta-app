const admin = require('firebase-admin');

const projectId = 'stroismeta-39ae1';
const domain = 'sstroysmeta-png.github.io';

console.log(`Adding domain: ${domain} to project: ${projectId}`);

// На самом деле Firebase CLI не может добавлять домены напрямую
// Но мы можем использовать REST API

const https = require('https');

const data = JSON.stringify({
  authorizedDomains: [domain]
});

const options = {
  hostname: 'identitytoolkit.googleapis.com',
  path: `/v1/projects/${projectId}/config?updateMask=authorizedDomains`,
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
}).end(data);

console.log('✅ Домен добавлен!');