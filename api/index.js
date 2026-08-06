export default async function handler(req, res) {
  try {
    const { app } = await import('../fonoaudio-server.js');
    app(req, res);
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed', message: err.message, stack: err.stack });
  }
}
