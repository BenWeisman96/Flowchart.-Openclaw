# Flowchart OpenClaw

Visual flowchart builder (React Flow) + Mermaid editor with a basic public API.

## What this app now includes

- **Visual Builder** tab (drag/drop nodes, connect paths)
- **Mermaid Code** tab (text-based render + SVG/PNG export)
- **Project tabs** across the top for multiple diagrams
- **Backend API** for create/read/update/delete diagrams
- **Apply Blueprint API** to replace a diagram from JSON in one call
- File-based persistence in `data/diagrams.json`

---

## Run locally (web + API together)

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5000`
- API: `http://localhost:5001`
- Frontend proxies `/api/*` to backend automatically.

## Build

```bash
npm run build
npm run preview
```

## Production run (single host for app + API)

```bash
npm run build
npm run start
```

- App: `GET /`
- API: `GET /api/*`

This is the mode to deploy on Replit (non-static deployment target).

---

## API (preliminary, no auth)

### Health
`GET /api/health`

### List projects
`GET /api/diagrams`

### Create project
`POST /api/diagrams`

```json
{
  "name": "My Project",
  "nodes": [],
  "edges": []
}
```

### Get one project
`GET /api/diagrams/:id`

### Update project
`PUT /api/diagrams/:id`

```json
{
  "name": "Updated Name",
  "nodes": [],
  "edges": []
}
```

### Delete project
`DELETE /api/diagrams/:id`

### Apply blueprint (replace nodes/edges)
`POST /api/diagrams/:id/apply-blueprint`

```json
{
  "name": "Optional new name",
  "nodes": [],
  "edges": []
}
```

---

## Notes

- This is intentionally open/basic for rapid iteration.
- Add auth, rate limiting, and stronger validation before long-term public production use.
