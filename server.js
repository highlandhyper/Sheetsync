
// @ts-check
const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
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

const certsDir = path.join(__dirname, '.certs');

// Check if certs exist before trying to read them
if (!fs.existsSync(path.join(certsDir, 'localhost-key.pem')) || !fs.existsSync(path.join(certsDir, 'localhost.pem'))) {
  console.error('\n\n\x1b[31m%s\x1b[0m', '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: SSL CERTIFICATES NOT FOUND');
  console.error('\x1b[31m%s\x1b[0m', `The server requires SSL certificates in the '.certs' folder but they were not found.`);
  console.error('\x1b[31m%s\x1b[0m', 'Please ensure `localhost-key.pem` and `localhost.pem` exist in that directory.');
  console.error('\x1b[31m%s\x1b[0m', 'You can generate them using a tool like `mkcert`.');
  console.error('\x1b[31m%s\x1b[0m', 'Application will exit.');
  console.error('\x1b[31m%s\x1b[0m', '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n');
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(path.join(certsDir, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(certsDir, 'localhost.pem')),
};


app.prepare().then(() => {
  // Create an HTTPS server
  createHttpsServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(httpsPort, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${httpsPort}`);
  });
  
  // Create an HTTP server that redirects to HTTPS
   createHttpServer((req, res) => {
    const host = req.headers.host || `localhost:${httpPort}`;
    const httpsUrl = `https://${host.replace(`:${httpPort}`, `:${httpsPort}`)
}${req.url}`;
    res.writeHead(301, { Location: httpsUrl });
    res.end();
  }).listen(httpPort, (err) => {
    if (err) throw err;
    console.log(`> HTTP server on http://localhost:${httpPort} is redirecting to HTTPS`);
  });
});
