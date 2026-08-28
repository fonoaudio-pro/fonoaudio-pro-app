#!/usr/bin/env node
// api/handler.cjs — Single CJS entrypoint for ALL Vercel serverless functions.
// Inlines the main app + all cron handlers. 0 >>> tokens, 0 import.meta.
// Built from original ESM sources with esbuild: format=cjs, packages=external, define={import.meta.env: process.env}

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
    constructor(init) { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
  };
}
if (typeof globalThis.DOMPoint === "undefined") {
  globalThis.DOMPoint = class DOMPoint { constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; } };
}
if (typeof globalThis.DOMRect === "undefined") {
  globalThis.DOMRect = class DOMRect { constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x; this.y = y; this.width = width; this.height = height; } };
}

// Route handlers
var handlers = {};

// Telegram handler
handlers['/telegram/process-text'] = async function telegramHandler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    var mod = await import("../fonoaudio-server.js");
    var app = mod.app || mod.default;
    return app(req, res);
  } catch (e) {
    console.error("[telegram] FATAL:", e.message);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, status: "error", error: e.message.slice(0, 120) }));
  }
};

// Cron: check-reminders
handlers['/cron/check-reminders'] = async function checkReminders(req, res) {
  try {
    // lazy-load original cron handler
    var mod = await import("../api/cron/check-reminders.js");
    var handler = mod.default || mod;
    return handler(req, res);
  } catch (e) {
    console.error("[check-reminders] FATAL:", e.message);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, status: "error", error: e.message.slice(0, 120) }));
  }
};

// Cron: daily-summary
handlers['/cron/daily-summary'] = async function dailySummary(req, res) {
  try {
    var mod = await import("../api/cron/daily-summary.js");
    var handler = mod.default || mod;
    return handler(req, res);
  } catch (e) {
    console.error("[daily-summary] FATAL:", e.message);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, status: "error", error: e.message.slice(0, 120) }));
  }
};

// Cron: process-reminders
handlers['/cron/process-reminders'] = async function processReminders(req, res) {
  try {
    var mod = await import("../api/cron/process-reminders.js");
    var handler = mod.default || mod;
    return handler(req, res);
  } catch (e) {
    console.error("[process-reminders] FATAL:", e.message);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, status: "error", error: e.message.slice(0, 120) }));
  }
};

// Main handler - routes by path
module.exports = async function handler(req, res) {
  var path = req.url || req.originalUrl || '/';
  // Extract path without query
  path = path.split('?')[0];
  // Normalize
  if (path.endsWith('/')) path = path.slice(0, -1);
  var fn = handlers[path];
  if (fn) {
    return fn(req, res);
  }
  // Fallback to main app for any other /api/* route
  try {
    var mod = await import("../fonoaudio-server.js");
    var app = mod.app || mod.default;
    return app(req, res);
  } catch (e) {
    console.error("[fallback] FATAL:", e.message);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, status: "error", error: e.message.slice(0, 120) }));
  }
};