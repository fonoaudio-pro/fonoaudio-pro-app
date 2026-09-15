const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/TELEGRAM_BOT_TOKEN=(.+)/)[1].replace(/['"]/g, '').trim();
const chatId = '5854700506';

// Send a direct POST to the webhook
const body = JSON.stringify({
  update_id: Math.floor(Math.random() * 1e9),
  message: {
    message_id: 1,
    chat: { id: 5854700506, type: 'private' },
    from: { id: 5854700506, is_bot: false, first_name: 'Mati' },
    voice: { file_id: 'test', duration: 0, mime_type: 'audio/ogg', file_size: 60 }
  }
});

console.log('Sending direct POST to /api/telegram/webhook...');

const opts = {
  hostname: 'fonoaudio-pro-ai.vercel.app',
  path: '/api/telegram/webhook',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};

const req = https.request(opts, (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    console.log('Webhook response status:', res.statusCode);
    console.log('Webhook response body:', d.substring(0, 300));
    
    // Wait 3s then check logs
    setTimeout(() => {
      const opts2 = {
        hostname: 'fonoaudio-pro-ai.vercel.app',
        path: '/api/telegram/logs',
        method: 'GET'
      };
      const req2 = https.request(opts2, (res2) => {
        let d2 = '';
        res2.on('data', (c) => d2 += c);
        res2.on('end', () => {
          try {
            const j = JSON.parse(d2);
            console.log('Debug logs:', j.debugLog?.length || 0);
            if (j.debugLog && j.debugLog.length > 0) {
              for (const e of j.debugLog) {
                console.log('  [' + e.context + ']', e.message);
              }
            }
            console.log('Error logs:', j.errorLog?.length || 0);
          } catch(e2) {
            console.log('Logs response:', d2.substring(0, 500));
          }
          process.exit(0);
        });
      });
      req2.on('error', (e) => { console.error('Log check error:', e.message); process.exit(1); });
      req2.end();
    }, 3000);
  });
});

req.on('error', (e) => { console.error('Error:', e.message); process.exit(1); });
req.write(body);
req.end();
