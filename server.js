// @ts-check
console.log('=== Custom server.js is running ===');

const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const fs = require('fs');
const path = require('path');

// Use dynamic import for Next.js
const dev = process.env.NODE_ENV !== 'production';

function getHttpsOptions() {
  const certsDir = path.join(__dirname, process.env.CERT_PATH || '.certs');
  const keyPath = path.join(certsDir, 'localhost+3-key.pem');
  const certPath = path.join(certsDir, 'localhost+3.pem');

  try {
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      console.warn('SSL certificate files not found. Running in HTTP-only mode.');
      console.warn('Expected files:', keyPath, 'and', certPath);
      return null;
    }

    console.log('Using SSL certificate:', certPath);
    console.log('Using SSL key:', keyPath);

    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  } catch (error) {
    console.error('Error reading SSL certificates:', error.message);
    return null;
  }
}

async function startServer() {
  const next = await import('next');
  const app = next.default({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();
  
  // Get ports from environment variables or use defaults
  const HTTP_PORT = process.env.HTTP_PORT || 3000;
  const HTTPS_PORT = process.env.PORT || 3001;

  const httpsOptions = getHttpsOptions();
  const canUseHttps = httpsOptions !== null;

  if (canUseHttps) {
    // Create HTTPS server
    const httpsServer = createHttpsServer(httpsOptions, (req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        return res.end('Invalid URL');
      }
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`> Ready on https://localhost:${HTTPS_PORT}`);
    });

    // Redirect HTTP to HTTPS
    const httpServer = createHttpServer((req, res) => {
      const host = req.headers.host?.split(':')[0] || 'localhost';
      const redirectUrl = `https://${host}:${HTTPS_PORT}${req.url || '/'}`;
      res.writeHead(301, { 'Location': redirectUrl });
      res.end();
    });

    httpServer.listen(HTTP_PORT, () => {
      console.log(`> HTTP server redirecting to HTTPS on port ${HTTP_PORT}`);
    });

    // Handle server errors
    const handleError = (error) => {
      console.error('Server error:', error);
      process.exit(1);
    };

    httpsServer.on('error', handleError);
    httpServer.on('error', handleError);
  } else {
    // Fallback to HTTP only if HTTPS is not available
    const httpServer = createHttpServer((req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        return res.end('Invalid URL');
      }
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    httpServer.listen(HTTP_PORT, () => {
      console.log(`> Running in HTTP mode on port ${HTTP_PORT} (HTTPS not available)`);
      console.log('> To enable HTTPS, please add your SSL certificate files to the .certs/ directory:');
      console.log('  - localhost+3-key.pem');
      console.log('  - localhost+3.pem');
    });
  }
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
