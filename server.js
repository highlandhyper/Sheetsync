// @ts-check
console.log('=== Custom server.js is running in HTTP-only mode ===');

const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');

// Use dynamic import for Next.js
const dev = process.env.NODE_ENV !== 'production';

async function startServer() {
  const next = await import('next');
  const app = next.default({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();
  
  // Get port from environment variable or use default
  const PORT = process.env.PORT || 3000;

  // Create HTTP server
  const server = createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      return res.end('Invalid URL');
    }
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});