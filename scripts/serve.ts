// Serves the hello cube page. Web root is /content, but ONLY these subtrees
// are exposed (to avoid serving all of /content, e.g. codex-react-ui, sa_all):
//   /slaengine/* -> /content/slaengine/*
//   /three.js/*  -> /content/three.js/*
//   /build/*     -> /content/slaengine/build/*  (relative imports from a page
//                  served at /)
//   / or /index.html -> /content/slaengine/index.html
// Tunnel-prefix tolerant: a leading first segment matching
// /^colab-\d+-\d+-[0-9a-f]+$/ or "slaengine-hello-cube" is stripped before
// resolving, so the page works whether or not the tunnel strips its prefix.
import { join } from "node:path";

const PORT = 43111;
const MAP: Array<[string, string]> = [
  ["/slaengine/", "/content/slaengine/"],
  ["/three.js/", "/content/three.js/"],
  ["/build/", "/content/slaengine/build/"],
];
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function resolve(pathname: string): string | null {
  let p = decodeURIComponent(pathname);
  const segs = p.split("/").filter(Boolean);
  if (segs.length > 1 && /^(colab-\d+-\d+-[0-9a-f]+|slaengine-hello-cube)$/.test(segs[0])) {
    p = "/" + segs.slice(1).join("/");
  }
  if (p === "/" || p === "/index.html") return "/content/slaengine/index.html";
  for (const [prefix, dir] of MAP) {
    if (p.startsWith(prefix)) {
      const rest = p.slice(prefix.length);
      if (rest.includes("..")) return null;
      return join(dir, rest);
    }
  }
  return null;
}

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const file = resolve(new URL(req.url).pathname);
    if (!file) return new Response("not found", { status: 404 });
    const f = Bun.file(file);
    if (!(await f.exists())) return new Response("not found", { status: 404 });
    const ext = "." + (file.split(".").pop() ?? "");
    return new Response(f, {
      headers: { "content-type": TYPES[ext] ?? "application/octet-stream" },
    });
  },
});
console.log(`slaengine bun serve listening on 127.0.0.1:${PORT}`);
