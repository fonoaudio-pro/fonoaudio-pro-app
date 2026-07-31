// Quick test: node test-telegram.js
const TOKEN = '8932871423:AAF7mooxe96wUlbFy5jrCbhA-ZgZC1iNrqs';
const CHAT_ID = '5854700506';

async function test() {
    console.log('1. Testing getMe...');
    const me = await fetch(`https://api.telegram.org/bot${TOKEN}/getMe`);
    const meData = await me.json();
    console.log('Bot:', meData.ok ? `@${meData.result.username}` : meData.description);

    console.log('\n2. Sending test message...');
    const msg = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: 'Test desde FonoAudio-Pro', parse_mode: 'HTML' })
    });
    const msgData = await msg.json();
    console.log('Result:', msgData.ok ? 'SENT OK' : msgData.description);

    console.log('\n3. Testing /api/telegram/send endpoint...');
    const ep = await fetch('http://localhost:3001/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test endpoint desde node' })
    });
    const epData = await ep.json();
    console.log('Endpoint:', epData.status || epData.message);
}
test().catch(e => console.error('ERROR:', e.message));
