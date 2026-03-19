# Firecrawl integration assessment for gstack (CAL-119)

## Fit assessment

**Conclusion: strong fit for a complementary integration.**

gstack already has an excellent deterministic browser surface (`/browse`) optimized for stateful interaction and QA. Firecrawl adds a different strength: fast multi-page discovery + extraction into structured markdown/JSON that can seed product strategy and implementation planning.

This means the right integration is **not** replacing `/browse`; it is adding a research evidence lane that feeds existing planning and review workflows.

## Architecture-informed integration points

Based on `ARCHITECTURE.md` and current skill flow (`Think → Plan → Build → Review → Test → Ship → Reflect`), the highest-leverage insertion points are:

1. **Pre-plan research (`/office-hours`, `/plan-ceo-review`)**
   - Use Firecrawl search/scrape to pull competitor pages, docs, and pricing evidence.
   - Convert findings into short briefs attached to design docs.

2. **Implementation planning (`/plan-eng-review`)**
   - Pull fresh docs/changelog snippets from dependencies to reduce stale assumptions.
   - Feed extracted technical constraints directly into architecture notes.

3. **Post-build evidence packaging (`/document-release`, QA report prep)**
   - Re-crawl changed docs/landing pages and compare extraction snapshots.
   - Publish machine-readable evidence artifacts alongside release notes.

## Proof-of-concept in this fork

This fork adds a runnable POC script:

- `scripts/firecrawl-gstack-poc.ts`
- `package.json` script: `firecrawl:demo`
- `.env.example` now documents `FIRECRAWL_API_KEY`

### What the POC does

1. Calls Firecrawl `search` for a user query.
2. Scrapes top results with `formats: ["markdown"]` and `onlyMainContent: true`.
3. Produces a durable brief in `reports/firecrawl-demo/{timestamp}.md`.
4. Produces machine-readable output in `reports/firecrawl-demo/{timestamp}.json`.
5. Produces a stakeholder-friendly HTML brief in `reports/firecrawl-demo/{timestamp}.html`.

### Run the POC

```bash
export FIRECRAWL_API_KEY=...
bun run firecrawl:demo "persistent browser daemon architecture" --limit=3

# optional: open the generated HTML brief in a browser for non-technical review
open reports/firecrawl-demo/*.html
```

## Why this demo is realistic

- Mirrors how gstack users already work: collect context first, then plan implementation.
- Generates reviewer-facing artifacts suitable for Linear attachments.
- Keeps boundaries clear: Firecrawl for extraction breadth, `/browse` for interaction depth.
