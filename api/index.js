// Polyfill browser globals needed by pdfjs-dist in serverless env
if (typeof global.DOMMatrix === 'undefined') {
  class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  }
  global.DOMMatrix = DOMMatrix;
}
if (typeof global.DOMPoint === 'undefined') {
  global.DOMPoint = class DOMPoint {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
  };
}
if (typeof global.DOMRect === 'undefined') {
  global.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height;
    }
  };
}
if (typeof global.CanvasRenderingContext2D === 'undefined') {
  global.CanvasRenderingContext2D = class {
    measureText() { return { width: 0 }; }
  };
}

export default async function handler(req, res) {
  try {
    const { app } = await import('../fonoaudio-server.js');
    app(req, res);
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed', message: err.message });
  }
}
