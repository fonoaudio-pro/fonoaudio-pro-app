// Test harness: load handler.cjs via __filename-aware require and start HTTP server.
// Simulates Vercel environment where __filename is available.
const app = require('C:/Users/Administrador/fonoaudio-pro-app-audit/server/handler.cjs').app;
const http = require('http');
const srv = http.createServer(app);
srv.listen(3999, '127.0.0.1', () => {
  console.log('SERVER_UP');
  // Test the telegram endpoint
  const data = JSON.stringify({"message_text":"hola","chat_id":"8706264359"});
  const req = http.request({
    hostname: '127.0.0.1', port: 3999, path: '/api/telegram/process-text',
    method: 'POST', headers: {'Content-Type':'application/json','Content-Length':data.length}
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      console.log('BODY:', body.substring(0, 600));
      srv.close();
      process.exit(0);
    });
  });
  req.write(data);
  req.end();
});
setTimeout(() => { console.error('TEST_TIMEOUT'); process.exit(1); }, 8000);
