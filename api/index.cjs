// api/index.cjs — FINAL: Pure CommonJS with ZERO import.meta/ESM syntax.
// Built from api/index.js (which used ESM imports) with esbuild:
// format: 'cjs', packages: 'external', define: { 'import.meta.env': 'process.env' }
// This bundle is pre-compiled so Vercel serves it as CommonJS, bypassing
// the ESM compileSourceTextModule crash (SyntaxError >>>).
//
// Do NOT edit manually - regenerate with: node build-all.cjs

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (fn = fn()).apply(this, arguments), fn = null), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (mod = cb(function (path) { return require(path); }, module)), mod.exports;
};
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, { get: (a, b) => (typeof require !== "undefined" ? require : a)[b] }) : x)(function (x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw new Error('Dynamic require of "' + x + '" is not supported');
});
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from)) {
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: true });
    }
  }
  return to;
};

// External modules (provided by Vercel's node_modules at runtime)
var express = __require("express");
var cors = __require("cors");
var dotenv = __require("dotenv");
dotenv.config();

// Polyfills for pdfjs-dist (browser globals)
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
if (typeof globalThis.DOMPoint === "undefined") {
  globalThis.DOMPoint = class DOMPoint {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
  };
}
if (typeof globalThis.DOMRect === "undefined") {
  globalThis.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height;
    }
  };
}

// Lazy-load fonoaudio-server (ESM) only when first request hits
var cachedApp;
async function loadApp() {
  if (!cachedApp) {
    var mod = await import("../fonoaudio-server.js");
    cachedApp = mod.app || mod.default;
  }
  return cachedApp;
}

// Vercel handler
module.exports = async function handler(req, res) {
  try {
    var app = await loadApp();
    return app(req, res);
  } catch (e) {
    console.error("[api/index.cjs] FATAL:", e.message);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, status: "error", error: e.message.slice(0, 120) }));
  }
};