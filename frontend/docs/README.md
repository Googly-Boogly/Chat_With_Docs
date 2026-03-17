# Frontend — Technical Documentation

## Overview

The frontend is a **React + Vite** single-page application that serves as the interactive demo surface for the RAG Poisoning project. It lets you upload documents, inject attack scenarios, toggle the defense pipeline, ask queries, and inspect the real-time `ThreatReport` returned by the backend.

---

## Stack

| Component | Library | Purpose |
|-----------|---------|---------|
| UI framework | React 18 | Component-based UI with hooks |
| Build tool | Vite 5 | Dev server + production bundler |
| HTTP server | Nginx (Alpine) | Serve static assets + proxy `/api` |
| Styling | Inline styles only | No CSS framework, no external deps |

---

## Project Structure

```
frontend/
├── Dockerfile.prod     Multi-stage: Node build → Nginx serve
├── nginx.conf          SPA routing + /api proxy to backend
├── index.html          HTML entry point + Google Fonts import
├── package.json        Dependencies and scripts
├── vite.config.js      Dev server + /api proxy config
├── docs/
│   └── README.md       This file
└── src/
    ├── main.jsx        React root — renders <App /> in StrictMode
    └── app.jsx         Entire application (intentional single-component file)
```

---

## Component Architecture

`app.jsx` is a single monolithic component. This is intentional — it keeps the demo self-contained and easy to read end-to-end.

### State

| Variable | Type | Purpose |
|----------|------|---------|
| `docs` | `string[]` | Document names currently in the vector store |
| `messages` | `Message[]` | Full chat + system message history |
| `input` | `string` | Current textarea value |
| `loading` | `boolean` | Awaiting a `/chat` response |
| `uploading` | `boolean` | Awaiting an `/upload` response |
| `dragOver` | `boolean` | Drag-and-drop highlight state |
| `defenseMode` | `boolean` | Whether defense pipeline is active (sent with each chat request) |
| `scenarios` | `Scenario[]` | Attack scenarios fetched from `/demo/scenarios` on mount |
| `injectingId` | `string \| null` | ID of the scenario currently being injected (button loading state) |
| `resetting` | `boolean` | Demo reset in progress |

### Message shape

```js
{
  role: "user" | "assistant",
  content: string,
  sources: string[],           // document names cited (assistant only)
  threat_report: object | null, // ThreatReport from backend (defense mode only)
  isWarning: boolean,          // amber styling for upload warnings / injection notices
  triggerQuery: string | null, // shows "→ Use trigger query" button if set
}
```

### Icon components

`FileIcon`, `TrashIcon`, `SendIcon`, `ShieldIcon` — lightweight inline SVGs, no icon library.

### Sub-components

**`SourceChip`** — Renders a single source filename citation. Accepts `source` (string) and `flagged` (bool) props — flagged sources render in red.

**`ThreatReport`** — Renders the four-layer defense analysis report returned by the backend. Sections:
- Layer 4 sub-card (LLM Judge): confidence %, attack type, reasoning, blocked status
- Layer 1: injection signature labels
- Layer 2: low-trust source count
- Layer 3: semantically anomalous chunk count
- Footer: total chunks removed

---

## API Communication

All requests use the `/api` prefix, resolved differently per environment:

| Environment | How `/api` resolves |
|-------------|----------------------|
| Docker (production) | Nginx proxies `/api/*` → `http://backend:8000/*` |
| Local dev | Vite dev server proxies `/api/*` → `http://localhost:8000/*` |

### Endpoints called

| Method | Path | When |
|--------|------|------|
| `GET` | `/api/documents` | On mount, after every upload/delete/reset |
| `POST` | `/api/upload` | File drop or file picker selection |
| `DELETE` | `/api/documents/{name}` | Trash icon click |
| `POST` | `/api/chat` | Send button or Enter key |
| `GET` | `/api/demo/scenarios` | On mount |
| `POST` | `/api/demo/inject/{id}` | "⚡ Inject" button click |
| `DELETE` | `/api/demo/reset` | "↺ Reset Demo" button click |

### `/api/chat` request body

```json
{
  "question": "What is the password policy?",
  "defense_mode": true
}
```

### `/api/chat` response (defense mode)

```json
{
  "answer": "...",
  "sources": ["company_security_policy.txt"],
  "chunks_used": 3,
  "threat_report": {
    "flagged": true,
    "patterns_found": ["instruction override"],
    "low_trust_chunk_indices": [1],
    "anomalous_chunk_indices": [1],
    "distances": [0.21, 0.89, 0.24],
    "trust_scores": [1.0, 0.3, 1.0],
    "chunks_removed": 1,
    "query_judge": {
      "is_injection": false,
      "confidence": 0.05,
      "attack_type": null,
      "reasoning": "Legitimate question about a company policy.",
      "blocked": false,
      "error": null
    },
    "summary": "THREAT DETECTED — ..."
  }
}
```

---

## Design System

Warm editorial dark theme — all tokens as inline CSS values:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#1a1714` | Main surface |
| Sidebar | `#15120f` | Secondary surface |
| Accent gold | `#b48c50` | Buttons, source chips, highlights |
| Threat red | `#dc6060` | Attack indicators, flagged sources, inject buttons |
| Defense green | `#4caf82` | Defense-on state, clean check marks |
| Text dim | `#9a8a72` | Captions, placeholders, secondary labels |
| Border subtle | `rgba(255,255,255,0.08)` | Panel dividers |

**Fonts** (loaded from Google Fonts in `index.html`):
- `Playfair Display` — display text and chat body
- `DM Mono` — monospace labels, status bar, source chips, scenario panel

---

## Sidebar Layout

```
┌─────────────────────────────┐
│ RAG Security                │  ← logo / project name
│ Poisoning Demo              │
├─────────────────────────────┤
│ [ Drop docs here ]          │  ← upload zone (drag + drop or click)
├─────────────────────────────┤
│ 2 Documents                 │  ← document list with delete buttons
│  📄 company_security_policy │
│  📄 prompt_injection.txt    │
├─────────────────────────────┤
│ ATTACK SCENARIOS            │  ← scenario injection panel
│ ┌─────────────────────────┐ │
│ │ Direct Prompt Injection │ │
│ │ OWASP LLM01 — ...       │ │
│ │ [⚡ Inject] [Try query] │ │
│ └─────────────────────────┘ │
│ [↺ Reset Demo]              │
├─────────────────────────────┤
│ Claude + ChromaDB + defense │  ← footer
└─────────────────────────────┘
```

---

## Running Locally

Requires the backend running on port 8000.

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

The Vite proxy in `vite.config.js` forwards `/api/*` → `http://localhost:8000/*`.

## Building for Production

```bash
npm run build   # output in /dist
```

The multi-stage `Dockerfile.prod` runs this automatically and copies the output into an Nginx image.
