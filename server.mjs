import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiApp } from './api-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5000);
const DIST_DIR = path.join(__dirname, 'dist');
const INDEX_FILE = path.join(DIST_DIR, 'index.html');

const app = createApiApp();

app.use(express.static(DIST_DIR));
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => {
  console.log(`[flowchart-app] listening on :${PORT}`);
});
