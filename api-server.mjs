import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'diagrams.json');
const LOG_FILE = path.join(__dirname, 'logs', 'api.log');

const MAX_BODY_BYTES = '1mb';

const DEFAULT_DIAGRAM = {
  id: 'arc-referral-flow',
  name: 'ARC Referral Flow',
  nodes: [
    { id: 'start', position: { x: 80, y: 120 }, data: { label: 'Agent posts opportunity' }, type: 'input' },
    { id: 'interest', position: { x: 360, y: 120 }, data: { label: 'Advisor marks Interested' } },
    { id: 'select', position: { x: 640, y: 120 }, data: { label: 'Agent selects advisor' } },
    { id: 'timeline', position: { x: 920, y: 120 }, data: { label: 'Timeline + comments + value tracking' }, type: 'output' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'interest' },
    { id: 'e2', source: 'interest', target: 'select' },
    { id: 'e3', source: 'select', target: 'timeline', label: 'selected' },
  ],
  updatedAt: new Date().toISOString(),
};

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ diagrams: [DEFAULT_DIAGRAM] }, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStorage();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed.diagrams || !Array.isArray(parsed.diagrams)) {
    return { diagrams: [] };
  }
  return parsed;
}

async function writeStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(name = 'diagram') {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'diagram'}-${Date.now().toString(36)}`;
}

function isValidArray(v) {
  return Array.isArray(v);
}

function sanitizeText(input, max = 5000) {
  return String(input ?? '').slice(0, max);
}

function validateDiagramPayload(body, { allowPartial = false } = {}) {
  if (!allowPartial || 'nodes' in body) {
    if (!isValidArray(body.nodes)) throw new Error('nodes must be an array');
  }
  if (!allowPartial || 'edges' in body) {
    if (!isValidArray(body.edges)) throw new Error('edges must be an array');
  }
  if ('name' in body && typeof body.name !== 'string') {
    throw new Error('name must be a string');
  }
}

async function logEvent(req, status, message = '') {
  const line = `${nowIso()}\t${req.method}\t${req.originalUrl}\t${status}\t${req.ip}\t${message}\n`;
  await fs.appendFile(LOG_FILE, line, 'utf8').catch(() => {});
}

export function createApiApp() {
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: MAX_BODY_BYTES }));

  app.get('/api/health', async (req, res) => {
    await logEvent(req, 200, 'health');
    res.json({ ok: true, service: 'flowchart-api', now: nowIso() });
  });

  app.get('/api/diagrams', async (req, res) => {
    const store = await readStore();
    const list = store.diagrams.map((d) => ({ id: d.id, name: d.name, updatedAt: d.updatedAt }));
    await logEvent(req, 200, `count=${list.length}`);
    res.json({ diagrams: list });
  });

  app.post('/api/diagrams', async (req, res) => {
    try {
      validateDiagramPayload(req.body);
      const store = await readStore();
      const name = sanitizeText(req.body.name || 'Untitled Diagram', 120) || 'Untitled Diagram';
      const diagram = {
        id: makeId(name),
        name,
        nodes: req.body.nodes,
        edges: req.body.edges,
        updatedAt: nowIso(),
      };
      store.diagrams.unshift(diagram);
      await writeStore(store);
      await logEvent(req, 201, `id=${diagram.id}`);
      res.status(201).json({ diagram });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request';
      await logEvent(req, 400, message);
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/diagrams/:id', async (req, res) => {
    const store = await readStore();
    const diagram = store.diagrams.find((d) => d.id === req.params.id);
    if (!diagram) {
      await logEvent(req, 404, 'not found');
      return res.status(404).json({ error: 'Diagram not found' });
    }
    await logEvent(req, 200, `id=${diagram.id}`);
    res.json({ diagram });
  });

  app.put('/api/diagrams/:id', async (req, res) => {
    try {
      validateDiagramPayload(req.body, { allowPartial: true });
      const store = await readStore();
      const i = store.diagrams.findIndex((d) => d.id === req.params.id);
      if (i < 0) {
        await logEvent(req, 404, 'not found');
        return res.status(404).json({ error: 'Diagram not found' });
      }

      const current = store.diagrams[i];
      const next = {
        ...current,
        name: 'name' in req.body ? sanitizeText(req.body.name || 'Untitled Diagram', 120) : current.name,
        nodes: 'nodes' in req.body ? req.body.nodes : current.nodes,
        edges: 'edges' in req.body ? req.body.edges : current.edges,
        updatedAt: nowIso(),
      };

      store.diagrams[i] = next;
      await writeStore(store);
      await logEvent(req, 200, `id=${next.id}`);
      res.json({ diagram: next });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request';
      await logEvent(req, 400, message);
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/diagrams/:id', async (req, res) => {
    const store = await readStore();
    const before = store.diagrams.length;
    store.diagrams = store.diagrams.filter((d) => d.id !== req.params.id);
    if (store.diagrams.length === before) {
      await logEvent(req, 404, 'not found');
      return res.status(404).json({ error: 'Diagram not found' });
    }
    await writeStore(store);
    await logEvent(req, 200, `id=${req.params.id}`);
    res.json({ ok: true });
  });

  app.post('/api/diagrams/:id/apply-blueprint', async (req, res) => {
    try {
      validateDiagramPayload(req.body);
      const store = await readStore();
      const i = store.diagrams.findIndex((d) => d.id === req.params.id);
      if (i < 0) {
        await logEvent(req, 404, 'not found');
        return res.status(404).json({ error: 'Diagram not found' });
      }

      const current = store.diagrams[i];
      const next = {
        ...current,
        name: sanitizeText(req.body.name || current.name, 120),
        nodes: req.body.nodes,
        edges: req.body.edges,
        updatedAt: nowIso(),
      };

      store.diagrams[i] = next;
      await writeStore(store);
      await logEvent(req, 200, `blueprint_applied id=${next.id}`);
      res.json({ diagram: next });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid request';
      await logEvent(req, 400, message);
      res.status(400).json({ error: message });
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const API_PORT = Number(process.env.PORT || process.env.API_PORT || 5001);
  const app = createApiApp();
  app.listen(API_PORT, () => {
    console.log(`[flowchart-api] listening on :${API_PORT}`);
  });
}
