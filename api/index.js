// Polyfill browser globals needed by pdfjs-dist in serverless env
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  }
  globalThis.DOMMatrix = DOMMatrix;
}
if (typeof globalThis.DOMPoint === 'undefined') {
  globalThis.DOMPoint = class DOMPoint {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
  };
}
if (typeof globalThis.DOMRect === 'undefined') {
  globalThis.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height;
    }
  };
}

// Use dynamic import to ensure polyfills are set before fonoaudio-server.js is loaded
let cachedApp;

export default async function handler(req, res) {
  if (!cachedApp) {
    const module = await import('../fonoaudio-server.js');
    cachedApp = module.app;
  }
  cachedApp(req, res);
}
