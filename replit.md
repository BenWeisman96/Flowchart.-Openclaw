# Flowchart Builder

A React + Vite web application for building and exporting Mermaid flowchart diagrams.

## Features
- Live Mermaid diagram editor with syntax highlighting
- Real-time preview of flowcharts and mindmaps
- Export diagrams as SVG or PNG
- Diagram code persisted to localStorage

## Tech Stack
- React 18 + TypeScript
- Vite 5 (build tool / dev server)
- Mermaid 11 (diagram rendering)

## Project Structure
- `src/App.tsx` — Main application component
- `src/main.tsx` — Entry point
- `src/styles.css` — Styles
- `index.html` — HTML template
- `vite.config.ts` — Vite configuration

## Development
- Dev server runs on port 5000 via `npm run dev`
- Configured for Replit proxy: `host: 0.0.0.0`, `allowedHosts: true`

## Deployment
- Configured as a static site deployment
- Build command: `npm run build`
- Public directory: `dist`
