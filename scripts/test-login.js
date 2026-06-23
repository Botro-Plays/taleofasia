const http = require('http');

function getCsrf() {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: 3000, path: '/api/auth/csrf', headers: { Host: 'taleofasia.com' } }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        const csrf = JSON.parse(d).csrfToken;
        const cookies = (r.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        resolve({ csrf, cookies });
      });
    }).on('error', reject);
  });
}

function login(csrf, cookies) {
  return new Promise((resolve, reject) => {
    const body = `username=botro&password=test&recaptchaToken=test&csrfToken=${csrf}`;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/auth/callback/credentials',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Cookie': cookies,
        'Host': 'taleofasia.com',
      },
    }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        console.log('Login Status:', r.statusCode);
        console.log('Location:', r.headers.location);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const { csrf, cookies } = await getCsrf();
  console.log('CSRF token:', csrf);
  console.log('Cookies:', cookies);
  await login(csrf, cookies);
}

run().catch(e => console.error('Error:', e.message));
