// Vercel serverless function - health check endpoint
// Self-contained: no external dependencies needed

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/api/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL === '1' ? 'vercel' : 'local'
    });
  }

  return res.status(404).json({ error: 'Not found' });
}
