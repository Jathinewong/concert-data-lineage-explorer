# Concert Data Lineage Explorer

An interactive lineage map from raw source data to final published reports, powered by dbt + ReactFlow.

## Phases

### ✅ Phase 1 — Dev Environment Setup *(Done)*
- Dev container with Node 22
- Port 5173 auto-forwarded
- `vite.config.ts` with `host: true`

### ✅ Phase 2 — Core Lineage Graph *(Done)*
- Parse `manifest.json` + `catalog.json`
- Interactive DAG with ReactFlow + Dagre
- Node colour-coding (model/seed/source)
- Click node → sidebar with metadata + columns

### ✅ Phase 3 — Search & Filtering *(Done)*
- Fuse.js fuzzy search over model/column names
- Highlight upstream/downstream lineage paths on click
- Filter by node type (models/seeds/sources)

### 🔜 Phase 4 — CI/CD & Deployment
- GitHub Pages deployment
- Auto-refresh lineage when dbt runs in CI
