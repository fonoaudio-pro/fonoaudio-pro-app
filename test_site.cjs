const https = require('https');
const req = https.get('https://fonoaudio-pro-ai.vercel.app', { headers: { 'User-Agent': 'node' } }, (r) => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => {
    console.log('Status:', r.statusCode);
    console.log('HTML length:', d.length);
    console.log('Has title:', d.includes('<title>FonoAudio-Pro'));
    console.log('Has manifest:', d.includes('manifest'));
    console.log('Has script:', d.includes('<script'));
    console.log('Has CSS:', d.includes('stylesheet'));
    const scripts = d.match(/<script[^>]*src=["'][^"']+["'][^>]*>/g);
    if (scripts) scripts.forEach(s => console.log('Script:', s));
    const css = d.match(/<link[^>]*href=["'][^"']+["'][^>]*>/g);
    if (css) css.forEach(c => console.log('CSS:', c));
  });
}).on('error', e => console.log('Error:', e.message));
req.setTimeout(15000, () => req.abort());
