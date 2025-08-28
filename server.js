// @ts-check
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Define the ports
const httpPort = 9002;
const httpsPort = 9003;

// Define SSL options
const certsDir = path.join(__dirname, '.certs');
const httpsOptions = {
  key: fs.readFileSync(path.join(certsDir, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(certsDir, 'localhost.pem')),
};

app.prepare().then(() => {
  // Create an HTTPS server
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(httpsPort, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${httpsPort}`);
  });
  
  // Also create an HTTP server for convenience, though HTTPS is primary
  // This can be removed if only HTTPS is desired.
   createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(httpPort, (err) => {
    if (err) throw err;
    console.log(`> Also ready on http://localhost:${httpPort}`);
  });
});
