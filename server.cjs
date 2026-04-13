const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serve(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Redirect root to index_app.html
  if (urlPath === '/') {
    urlPath = '/index_app.html';
  }

  // Prevent directory traversal
  const filePath = path.join(DIST_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Find a free port starting from 18080
function findPort(start, cb) {
  const server = http.createServer();
  server.listen(start, '127.0.0.1', () => {
    server.close(() => cb(start));
  });
  server.on('error', () => findPort(start + 1, cb));
}

function openBrowser(url) {
  switch (process.platform) {
    case 'win32':
      exec(`start "" "${url}"`);
      break;
    case 'darwin':
      exec(`open "${url}"`);
      break;
    default:
      exec(`xdg-open "${url}"`);
  }
}

findPort(18080, (port) => {
  const server = http.createServer(serve);
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`HistoryMap is running at ${url}`);
    console.log('Press Ctrl+C to stop.');
    openBrowser(url);
  });
});
