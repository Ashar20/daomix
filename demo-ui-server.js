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
  let filePath;
  let contentType = 'text/html';

  if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(ROOT_DIR, 'demo-ui.html');
    contentType = 'text/html';
  } else if (req.url === '/publishing' || req.url === '/publishing.html') {
    filePath = path.join(ROOT_DIR, 'demo-ui-publishing.html');
    contentType = 'text/html';
  } else if (req.url === '/polkadot-browser-bundle.js') {
    filePath = path.join(ROOT_DIR, 'polkadot-browser-bundle.js');
    contentType = 'application/javascript';
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading file');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🌐 Demo UI Server running on http://127.0.0.1:${PORT}`);
  console.log(`📋 Voting Demo: http://127.0.0.1:${PORT}/`);
  console.log(`📰 Publishing Demo: http://127.0.0.1:${PORT}/publishing`);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping demo UI server...');
  server.close(() => {
    console.log('✅ Demo UI server stopped');
    process.exit(0);
  });
});
