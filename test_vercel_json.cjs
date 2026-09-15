const vc = {
  version: 2,
  routes: [
    { src: "/api/(.*)", dest: "/api/index.js" },
    { src: "/(.*)", dest: "/dist/$1" }
  ],
  env: { VERCEL: "1" }
};
const json = JSON.stringify(vc);
console.log("JSON:", json);
const b64 = Buffer.from(json).toString('base64');
console.log("Base64:", b64);
const decoded = Buffer.from(b64, 'base64').toString();
console.log("Decoded:", decoded);
console.log("Match:", json === decoded);
