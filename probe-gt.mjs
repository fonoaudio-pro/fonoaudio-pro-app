
const esbuild = require("esbuild");
const fs = require("fs");
const OUT = "C:/Users/Administrador/AppData/Local/Temp/postfix.mjs";
esbuild.build({
  entryPoints: ["api/index.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: true,
  outfile: OUT,
  logLevel: "silent",
  external: ["googleapis","google-auth-library","@google/auth","@supabase/supabase-js","uuid","dotenv","@google/generative-ai","pdf-parse","pdfjs-dist"]
}).then(r => {
  const o = fs.readFileSync(OUT, "utf8");
  console.log("BYTES=" + o.length);
  const idxs = [];
  let i = 0;
  while ((m = o.indexOf(">>>", i)) !== -1) {
    idxs.push(m);
    i = m + 1;
  }
  console.log("GT_COUNT=" + idxs.length);
  idxs.slice(0, 10).forEach(m => {
    console.log("CTX=" + o.slice(Math.max(0, m-35), m+35).replace(/\n/g, " "));
  });
}).catch(e => console.log("FAIL=" + e.message.slice(0,150)));
