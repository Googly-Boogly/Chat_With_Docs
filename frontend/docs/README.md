# Frontend — Technical Documentation

## Overview

The frontend is a **React + Vite** single-page application that provides a chat interface for the RAG document assistant. It communicates exclusively with the backend REST API and is served by Nginx in production.

---

## Stack

| Component | Library | Purpose |
|-----------|---------|---------|
| UI framework | React 18 | Component-based UI |
| Build tool | Vite 5 | Dev server + production bundler |
| HTTP server | Nginx (Alpine) | Serve static assets + proxy API |
| Styling | Inline styles + CSS-in-JS | Single-file, zero dependencies |

---

## Project Structure

```
frontend/
├── Dockerfile          Multi-stage: Node build → Nginx serve
├── nginx.conf          SPA routing + /api proxy to backend
├── index.html          HTML entry point + font imports
├── package.json        Dependencies and scripts
├── vite.config.js      Dev server + proxy config
├── docs/
│   └── README.md       This file
└── src/
    ├── main.jsx        React root render
    └── App.jsx         Entire application (single component file)
```

---

## Component Architecture

`App.jsx` is intentionally kept as a single file for clarity in this example project. It contains:

**State:**
| Variable | Type | Purpose |
|----------|------|---------|
| `docs` | `string[]` | List of ingested document names |
| `messages` | `Message[]` | Full chat history |
| `input` | `string` | Current textarea value |
| `loading` | `boolean` | Awaiting a `/chat` response |
| `uploading` | `boolean` | Awaiting an `/upload` response |
| `dragOver` | `boolean` | Drag-and-drop visual state |

**Key interactions:**
- `fetchDocs()` — called on mount and after every upload/delete
- `handleUpload(files)` — posts `multipart/form-data` to `/api/upload`
- `deleteDoc(name)` — sends `DELETE /api/documents/{name}`
- `handleSend()` — posts `{ question }` to `/api/chat`, appends response + sources to messages

---

## API Communication

All API requests use the `/api` prefix. This works in both environments:

| Environment | How `/api` is resolved |
|-------------|------------------------|
| Docker (prod) | Nginx proxies `/api/*` → `http://backend:8000/*` |
| Local dev | Vite dev server proxies `/api/*` → `http://localhost:8000/*` |

This means the frontend never needs to know the backend's host address — routing is handled by the server layer.

---

## Design System

The UI uses a **warm editorial dark theme** with these tokens (inline CSS variables):

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#1a1714` | Main surface |
| Sidebar | `#15120f` | Secondary surface |
| Accent | `#b48c50` | Gold — buttons, highlights, source chips |
| Text dim | `#9a8a72` | Captions, placeholders |
| Border | `rgba(255,255,255,0.08)` | Subtle dividers |

**Fonts:**
- `Playfair Display` — display and chat body text
- `DM Mono` — monospace labels, status, source chips

---

## Running Locally (without Docker)

Requires the backend to be running on port 8000.

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:3000
```

The Vite dev server's proxy (in `vite.config.js`) forwards `/api/*` calls to `http://localhost:8000/*` automatically.

---

## Building for Production

```bash
npm run build
# Output in /dist — served by Nginx in Docker
```

The Docker build handles this automatically via the multi-stage `Dockerfile`.