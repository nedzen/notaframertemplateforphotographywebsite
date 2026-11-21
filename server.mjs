import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.argv[2] || 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

const mimeFor = (file) => MIME[path.extname(file).toLowerCase()] || "application/octet-stream";

async function stat(file) {
  try { return await fsp.stat(file); } catch { return null; }
}

async function resolve(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) return null;

  let info = await stat(file);
  if (info?.isDirectory()) {
    file = path.join(file, "index.html");
    info = await stat(file);
  }

  // Clean URLs all render the single-page template.
  if (!info) {
    if (!path.extname(pathname)) {
      file = path.join(ROOT, "index.html");
      info = await stat(file);
    }
  }

  return info?.isFile() ? file : null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const file = await resolve(url.pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const info = await fsp.stat(file);
    const type = mimeFor(file);
    const headers = {
      "content-type": type,
      "x-content-type-options": "nosniff",
      "accept-ranges": "bytes",
      "cache-control":
        type.startsWith("text/html") || file.includes("/src/")
          ? "no-cache"
          : "public, max-age=3600",
    };

    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const match = range.match(/^bytes=(\d*)-(\d*)/);
      if (match) {
        let start = match[1] ? Number(match[1]) : 0;
        let end = match[2] ? Number(match[2]) : info.size - 1;
        if (!match[1] && match[2]) {
          start = info.size - Number(match[2]);
          end = info.size - 1;
        }
        if (start < 0) start = 0;
        if (end >= info.size) end = info.size - 1;
        if (start > end) {
          res.writeHead(416, { "content-range": `bytes */${info.size}` });
          res.end();
          return;
        }
        headers["content-range"] = `bytes ${start}-${end}/${info.size}`;
        headers["content-length"] = String(end - start + 1);
        res.writeHead(206, headers);
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
    }

    headers["content-length"] = String(info.size);
    res.writeHead(200, headers);
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal error");
    console.error(error);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Template running at http://localhost:${PORT}`);
});
