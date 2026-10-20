const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { build, standaloneName } = require('./build.cjs');

const { outDir } = build();
const files = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/styles.css': ['styles.css', 'text/css'],
  '/geometry.js': ['geometry.js', 'text/javascript'],
  '/app.js': ['app.js', 'text/javascript'],
  [`/${standaloneName}`]: [standaloneName, 'text/html']
};
const port = Number(process.env.PORT || 8080);
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  const entry = files[pathname];
  if (!entry || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.writeHead(200, { 'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(path.join(outDir, entry[0])).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`WingMAC: http://127.0.0.1:${port}`));
