const http = require('http');
const fs = require('fs');
const path = require('path');

const types = {
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon'
};

const dir = __dirname;

http.createServer((req, res) => {
  let fp = req.url === '/' ? path.join(dir, 'index.html') : path.join(dir, req.url);
  fs.readFile(fp, (e, d) => {
    if (e) {
      res.writeHead(404);
      res.end('404');
    } else {
      let ext = path.extname(fp).slice(1);
      res.writeHead(200, {
        'Content-Type': types[ext] || 'text/plain',
        'Cache-Control': 'no-store'
      });
      res.end(d);
    }
  });
}).listen(8080, () => console.log('Server: http://localhost:8080'));
