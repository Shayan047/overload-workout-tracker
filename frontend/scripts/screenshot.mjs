// Review screenshots: renders a route of the web build in review mode (fixed sample data)
// at the designs' size and saves it to review/<NN-name>.png.
//
//   npm run shot -- <route> <NN-name> [height] [--no-build] [--url=http://localhost:8081]
//
//   npm run shot -- index 07-today              builds the web export, then shoots "/"
//   npm run shot -- progress 13-progress 1240 --no-build
//
// Routes may be written with or without the leading slash ("progress", "/progress");
// "index" is the root. Prefer the slash-less form in Git Bash, which rewrites "/..."
// arguments into Windows paths.
//
// The viewport is 390 px wide at deviceScaleFactor 2, so PNGs are 780 px wide like
// design/screens. `height` (default 844) sets the viewport height for taller designs.
// Without --url the script exports the web build to dist/ (skip with --no-build) and serves
// it itself; with --url it uses a running `expo start --web` instead.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(FRONTEND, 'dist');
const REVIEW = join(FRONTEND, 'review');
const WIDTH = 390;
const SCALE = 2;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const urlFlag = args.find((a) => a.startsWith('--url='));
const [route, name, heightArg] = args.filter((a) => !a.startsWith('--'));

if (!route || !name || !/^\d\d-[a-z0-9-]+$/.test(name)) {
  console.error('Usage: npm run shot -- <route> <NN-name> [height] [--no-build] [--url=<dev server>]');
  process.exit(1);
}
if (/^[A-Za-z]:[\\/]/.test(route)) {
  console.error(
    `The route arrived as a Windows path ("${route}"); Git Bash rewrites arguments that ` +
      'start with "/". Write it without the slash (e.g. "progress", or "index" for the root).',
  );
  process.exit(1);
}
const routePath = route === 'index' ? '/' : `/${route.replace(/^\/+/, '')}`;
const height = heightArg ? Number(heightArg) : 844;
if (!Number.isInteger(height) || height < 400) {
  console.error(`Height must be a whole number of pixels, got "${heightArg}".`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function buildWeb() {
  console.log('Exporting the web build…');
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'], {
    cwd: FRONTEND,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Serves dist/; unknown paths get index.html so client-side routes work. */
async function serveDist() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    let file = join(DIST, path);
    if (!file.startsWith(DIST)) return res.writeHead(403).end();
    try {
      if (!(await stat(file)).isFile()) file = join(DIST, 'index.html');
    } catch {
      file = join(DIST, 'index.html');
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function pngSize(path) {
  const header = readFileSync(path).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

let server;
let base = urlFlag?.slice('--url='.length).replace(/\/$/, '');
if (!base) {
  if (!flags.has('--no-build')) buildWeb();
  ({ server, base } = await serveDist());
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height }, deviceScaleFactor: SCALE });
  const target = new URL(routePath, base);
  target.searchParams.set('review', '1');
  await page.goto(target.href, { waitUntil: 'networkidle' });
  // The app sets this once its fonts are loaded (src/review/reviewMode.ts).
  await page.waitForSelector('html[data-review-ready="true"]', { state: 'attached', timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  await mkdir(REVIEW, { recursive: true });
  const out = join(REVIEW, `${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  const size = pngSize(out);
  console.log(`Saved ${out} (${size.width} × ${size.height})`);
} finally {
  await browser.close();
  server?.close();
}
