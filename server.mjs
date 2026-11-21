import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT || process.argv[2] || 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.framercms': 'application/javascript; charset=utf-8',
};

// route -> Server-Timing payload, mirroring the Framer host
const ROUTE_IDS = {
  '/': 'id=augiA20Il',
  '/grid': 'id=AQxgCEJWV',
  '/about': 'id=xG6sUwSFI',
  '/contact': 'id=MH5ySfFCc',
  '/404': 'id=vW_8WDpiG',
};
const PROJECT_ROUTE = 'id=JSBZGFB2P';
const CDN_PREFIX = '/_cdn' + '_'.repeat('https://framerusercontent.com'.length - 5);

const mimeFor = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

function routeTiming(urlPath) {
  const clean = urlPath.replace(/\/+$/, '') || '/';
  if (ROUTE_IDS[clean]) return `${ROUTE_IDS[clean]}&locale=default`;
  const m = clean.match(/^\/projects\/([^/]+)$/);
  if (m) return `${PROJECT_ROUTE}&locale=default&var.s0SmNxKoE=${encodeURIComponent(m[1])}`;
  return null;
}

async function stat(p) {
  try { return await fsp.stat(p); } catch { return null; }
}

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let target = path.join(ROOT, safe);
  if (!target.startsWith(ROOT)) return null;

  let st = await stat(target);
  if (st?.isDirectory()) {
    target = path.join(target, 'index.html');
    st = await stat(target);
  } else if (!st && !path.extname(target)) {
    const alt = path.join(target, 'index.html');
    const ast = await stat(alt);
    if (ast) { target = alt; st = ast; }
  }

  if (st?.isFile()) return { file: target, status: 200 };
  const notFound = path.join(ROOT, '404', 'index.html');
  if (await stat(notFound)) return { file: notFound, status: 404 };
  return null;
}

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleFormSubmit(req, res) {
  const body = await readBody(req);
  let fields = {};
  try {
    const form = await new Request('http://localhost', { method: 'POST', headers: req.headers, body }).formData();
    for (const [k, v] of form) if (typeof v === 'string' && !k.startsWith('__framer')) fields[k] = v;
  } catch {
    fields = { raw: body.toString('utf8') };
  }
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.appendFile(path.join(DATA_DIR, 'submissions.jsonl'), JSON.stringify({ at: new Date().toISOString(), fields }) + '\n');
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ ok: true }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = url.pathname;
    if (pathname.startsWith(CDN_PREFIX)) pathname = '/framerusercontent.com' + pathname.slice(CDN_PREFIX.length);
    if (url.pathname.startsWith('/api/forms/') && url.pathname.endsWith('/submit')) {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST' });
        res.end();
        return;
      }
      await handleFormSubmit(req, res);
      return;
    }
    const found = await resolveFile(pathname);
    if (!found) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    if (pathname === '/404' || pathname === '/404/' || pathname === '/404.html') found.status = 404;
    const st = await fsp.stat(found.file);
    const type = pathname === '/fonts.googleapis.com/css2' ? 'text/css; charset=utf-8' : mimeFor(found.file);

    // Framer CMS chunks are fetched as byte slices via ?range=start-end
    const rangeQuery = url.searchParams.get('range');
    if (rangeQuery) {
      const m = rangeQuery.match(/^(\d+)-(\d+)$/);
      if (m) {
        const start = Number(m[1]);
        const end = Math.min(Number(m[2]), st.size - 1);
        if (start <= end) {
          const buf = await fsp.readFile(found.file);
          const slice = buf.subarray(start, end + 1);
          res.writeHead(200, {
            'content-type': type,
            'content-length': String(slice.length),
            'x-content-type-options': 'nosniff',
            'cache-control': 'public, max-age=31536000, immutable',
            'accept-ranges': 'bytes',
          });
          if (req.method === 'HEAD') { res.end(); return; }
          res.end(slice);
          return;
        }
      }
    }
    const isHtml = type.startsWith('text/html');
    const headers = {
      'content-type': type,
      'x-content-type-options': 'nosniff',
      'accept-ranges': 'bytes',
      'cache-control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    };
    if (isHtml) {
      const timing = routeTiming(pathname);
      if (timing) headers['server-timing'] = `route;desc="${timing}"`;
    }

    const range = req.headers.range;
    let start = 0;
    let end = st.size - 1;
    if (range && /^bytes=/.test(range) && st.size > 0) {
      const m = range.match(/^bytes=(\d*)-(\d*)/);
      if (m) {
        if (m[1]) start = Number(m[1]);
        if (m[2]) end = Number(m[2]);
        if (!m[1] && m[2]) { start = st.size - Number(m[2]); end = st.size - 1; }
        if (start < 0) start = 0;
        if (end >= st.size) end = st.size - 1;
        if (start > end) {
          res.writeHead(416, { 'content-range': `bytes */${st.size}` });
          res.end();
          return;
        }
        headers['content-range'] = `bytes ${start}-${end}/${st.size}`;
        headers['content-length'] = String(end - start + 1);
        res.writeHead(206, headers);
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(found.file, { start, end }).pipe(res);
        return;
      }
    }

    headers['content-length'] = String(st.size);
    res.writeHead(found.status, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(found.file).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
    console.error(err);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Framer mirror running at http://localhost:${PORT}`);
});
