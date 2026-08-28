// Test: load handler.cjs via require() and start a mini-server.
// Verifies the bundle works as pure CJS with 0 dynamic imports.
try {
  const handlerModule = require('C:/Users/Administrador/fonoaudio-pro-app-audit/server/handler.cjs');
  const app = handlerModule.app;
  if (!app) {
    console.error('NO APP EXPORTED');
    console.log('module keys:', Object.keys(handlerModule));
    process.exit(1);
  }
  const http = require('http');
  const server = http.createServer(app);
  server.listen(3999, '127.0.0.1', () => {
    console.log('TEST SERVER on http://127.0.0.1:3999');
    // Test telegram endpoint
    const data = JSON.stringify({"message_text":"hola","chat_id":"8706264359"});
    http.request({
      hostname: '127.0.0.1', port: 3999, path: '/api/telegram/process-text',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', body.substring(0, 500));
        server.close();
        process.exit(0);
      });
    }).end(data);
  });
  setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 5000);
} catch (e) {
  console.error('REQUIRE FAILED:', e.message);
  process.exit(1);
}
