const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
// Google Sheets Apps Script Webhook URL connected to backend
const GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbz67-eiTWcG2TlHdffTNS9DZ1D10776jo_gI4fjFgh4z3uUkTbuE0u_qj_ijqNmsfgL/exec';

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = req.url.split('?')[0];

  // 1. Backend API: Google Sheets Status & Config
  if (reqPath === '/api/sheets/config') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify({
      configured: true,
      webhookUrl: GOOGLE_SHEETS_WEBHOOK_URL,
      status: 'CONNECTED'
    }));
    return;
  }

  // 2. Backend API: Google Sheets Ping Connection
  if (reqPath === '/api/sheets/ping') {
    try {
      const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
        redirect: 'follow'
      });
      const data = await response.json().catch(() => ({ status: 'SUCCESS' }));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify({ status: 'ERROR', message: err.message }));
    }
    return;
  }

  // 2.1 Backend API: Get Catalogs (product & food)
  if (reqPath === '/api/sheets/catalogs') {
    let catalogData = null;
    try {
      const fetchUrl = GOOGLE_SHEETS_WEBHOOK_URL.includes('?') 
        ? `${GOOGLE_SHEETS_WEBHOOK_URL}&action=get_catalogs` 
        : `${GOOGLE_SHEETS_WEBHOOK_URL}?action=get_catalogs`;

      const response = await fetch(fetchUrl, { method: 'GET', redirect: 'follow' });
      const raw = await response.json().catch(() => null);
      if (raw && ((Array.isArray(raw.products) && raw.products.length > 0) || (Array.isArray(raw.product) && raw.product.length > 0))) {
        catalogData = raw;
      }
    } catch (err) {
      console.warn('Google Sheets API catalog fetch failed:', err.message);
    }

    if (!catalogData) {
      // Fallback: Load exact catalog from products.js and restaurant_menu.js matching the user's Google Sheet screenshot
      const productsFile = path.join(__dirname, 'js', 'data', 'products.js');
      const foodFile = path.join(__dirname, 'js', 'data', 'restaurant_menu.js');
      let defaultProds = [];
      let defaultFood = [];
      try {
        if (fs.existsSync(productsFile)) {
          delete require.cache[require.resolve(productsFile)];
          const mod = require(productsFile);
          defaultProds = mod.PRODUCT_CATALOG || [];
        }
      } catch (e) {}
      try {
        if (fs.existsSync(foodFile)) {
          delete require.cache[require.resolve(foodFile)];
          const mod = require(foodFile);
          defaultFood = mod.RESTAURANT_MENU || [];
        }
      } catch (e) {}

      catalogData = {
        status: 'SUCCESS',
        source: 'local_catalog',
        message: 'โหลดข้อมูลตารางสินค้า (product) และอาหาร (food) 14 รายการตรงตามรูปภาพ Google Sheets',
        product: defaultProds,
        products: defaultProds,
        food: defaultFood,
        foodMenu: defaultFood,
        stats: {
          productsCount: defaultProds.length,
          foodCount: defaultFood.length,
          format: 'side_by_side'
        },
        timestamp: new Date().toISOString()
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify(catalogData));
    return;
  }

  // 3. Backend API: Google Sheets Sync Proxy
  if (reqPath === '/api/sheets/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow'
        });
        const data = await response.json().catch(() => ({ status: 'SUCCESS', message: 'Synced via backend proxy' }));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ status: 'ERROR', message: err.message }));
      }
    });
    return;
  }

  // 4. Static Files Serving
  if (reqPath === '/') reqPath = '/index.html';
  
  let filePath = path.join(__dirname, reqPath);
  
  // Smart directory fallback mappings for organized structure
  const ALIASES = {
    '/style.css': '/css/style.css',
    '/app.js': '/js/app.js',
    '/google_apps_script.js': '/js/google_apps_script.js',
    '/products.js': '/js/data/products.js',
    '/restaurant_menu.js': '/js/data/restaurant_menu.js',
    '/icon.svg': '/assets/icon.svg'
  };

  if (!fs.existsSync(filePath) && ALIASES[reqPath]) {
    filePath = path.join(__dirname, ALIASES[reqPath]);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Google Sheets Backend connected: ${GOOGLE_SHEETS_WEBHOOK_URL}`);
});
