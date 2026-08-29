// Minimal CJS handler for testing — pure CJS, no imports, no >>>, no import.meta.
// If Vercel @vercel/node serves this correctly, the issue is in the server bundle.
// If Vercel still crashes, the issue is Vercel config/framework detection.
const handler = (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    status: 'success',
    message: '✅ handler.cjs minimal test — Vercel serves CJS correctly',
    method: req.method,
    url: req.url,
    hasBundler: true
  }));
};
module.exports = handler;
