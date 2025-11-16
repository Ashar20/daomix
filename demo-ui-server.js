#!/usr/bin/env node

/**
 * Simple HTTP server to serve demo-ui.html
 * This is a minimal, clean server just for the demo interface
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT_DIR = __dirname;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    // Serve demo-ui.html
    const filePath = path.join(ROOT_DIR, 'demo-ui.html');

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading demo UI');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🌐 Demo UI Server running on http://127.0.0.1:${PORT}`);
  console.log(`📋 Open this URL in your browser to access the demo`);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping demo UI server...');
  server.close(() => {
    console.log('✅ Demo UI server stopped');
    process.exit(0);
  });
});
