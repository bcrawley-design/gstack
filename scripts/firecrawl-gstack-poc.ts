import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

type FirecrawlSearchResult = {
  url: string;
  title?: string;
  description?: string;
};

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: FirecrawlSearchResult[];
  error?: string;
};

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
      url?: string;
    };
  };
  error?: string;
};

type DemoSource = {
  url: string;
  title: string;
  snippet: string;
  markdownLength: number;
  error?: string;
};

type DemoMode = 'live' | 'fixture';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtmlBrief(input: {
  query: string;
  mode: DemoMode;
  generatedAt: string;
  sources: DemoSource[];
  successfulSources: number;
  jsonPath: string;
}): string {
  const sourceCards = input.sources
    .map((source, index) => {
      const status = source.error ? `⚠️ ${escapeHtml(source.error)}` : '✅ Success';
      const snippet = source.snippet?.trim()
        ? `<p class="snippet">${escapeHtml(source.snippet)}</p>`
        : '<p class="snippet muted">No extractable snippet returned.</p>';

      return `
      <article class="card">
        <div class="card-header">
          <h3>${index + 1}. ${escapeHtml(source.title)}</h3>
          <span class="status">${status}</span>
        </div>
        <p><strong>URL:</strong> <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a></p>
        <p><strong>Extracted markdown:</strong> ${source.markdownLength.toLocaleString()} chars</p>
        ${snippet}
      </article>`;
    })
    .join('\n');

  const queryEncoded = escapeHtml(input.query);
  const modeLabel = input.mode === 'live' ? 'Live Firecrawl API' : 'Fixture mode (no API key)';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Firecrawl Research Brief</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #f6f7fb; color: #10121a; }
    main { max-width: 980px; margin: 0 auto; padding: 28px 20px 56px; }
    .hero { background: white; border-radius: 14px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 18px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 12px; }
    .meta div { background: #f1f4ff; padding: 10px 12px; border-radius: 10px; }
    .value { margin-top: 14px; border-left: 4px solid #5b7cff; background: #f5f8ff; padding: 12px; border-radius: 8px; }
    .grid { display: grid; gap: 12px; }
    .card { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
    .card-header { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    h1,h2,h3 { margin: 0 0 8px; }
    p { margin: 6px 0; line-height: 1.45; }
    .status { font-size: 0.9rem; color: #465; }
    .snippet { margin-top: 10px; padding: 10px; background: #f8f9ff; border-radius: 8px; }
    .muted { opacity: 0.7; }
    .footer { margin-top: 18px; font-size: 0.95rem; opacity: 0.9; }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>Firecrawl Research Brief (gstack POC)</h1>
      <p><strong>Question:</strong> ${queryEncoded}</p>
      <div class="meta">
        <div><strong>Generated</strong><br/>${escapeHtml(input.generatedAt)}</div>
        <div><strong>Mode</strong><br/>${modeLabel}</div>
        <div><strong>Sources analyzed</strong><br/>${input.sources.length}</div>
        <div><strong>Sources with extractable content</strong><br/>${input.successfulSources}</div>
      </div>
      <p class="value"><strong>Why this matters:</strong> This run converts one plain-language question into a reusable evidence package (human brief + structured JSON) that a stakeholder can review and act on without writing custom scraping logic.</p>
    </section>

    <section>
      <h2>Top Sources</h2>
      <div class="grid">
        ${sourceCards}
      </div>
    </section>

    <section class="footer">
      <p><strong>Structured artifact path:</strong> <code>${escapeHtml(input.jsonPath)}</code></p>
      <p>This demo complements gstack /browse workflows: Firecrawl handles multi-page extraction, then operators use this brief for planning and decision-making.</p>
    </section>
  </main>
</body>
</html>`;
}

const OFFLINE_FIXTURE_SOURCES: DemoSource[] = [
  {
    title: 'Firecrawl documentation',
    url: 'https://docs.firecrawl.dev',
    markdownLength: 1245,
    snippet:
      'Firecrawl turns websites into LLM-ready markdown and structured data. It supports crawl, scrape, and search endpoints for repeatable web extraction pipelines.',
  },
  {
    title: 'Firecrawl API reference',
    url: 'https://docs.firecrawl.dev/api-reference/introduction',
    markdownLength: 993,
    snippet:
      'The API reference documents search, scrape, and crawl semantics, including options for only-main-content extraction and output formats such as markdown.',
  },
  {
    title: 'Firecrawl crawl endpoint',
    url: 'https://docs.firecrawl.dev/api-reference/endpoint/crawl',
    markdownLength: 1108,
    snippet:
      'The crawl endpoint supports deep discovery with extraction settings per page, enabling teams to build durable ingestion flows with traceable output files.',
  },
];

function parseArgs(argv: string[]): { query: string; limit: number } {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const query = positional.join(' ').trim();
  const limitFlag = argv.find((arg) => arg.startsWith('--limit='));
  const limit = Number(limitFlag?.split('=')[1] ?? '3');

  if (!query) {
    throw new Error('Usage: bun run firecrawl:demo "<research query>" [--limit=3]');
  }

  if (!Number.isFinite(limit) || limit < 1 || limit > 10) {
    throw new Error('`--limit` must be a number between 1 and 10.');
  }

  return { query, limit };
}

async function firecrawlRequest<T>(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://api.firecrawl.dev/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(`Firecrawl ${endpoint} failed (${response.status}): ${payload.error ?? 'unknown error'}`);
  }

  return payload as T;
}

async function main() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const { query, limit } = parseArgs(process.argv.slice(2));

  let mode: DemoMode = 'live';
  let scraped: DemoSource[] = [];

  if (!apiKey) {
    mode = 'fixture';
    scraped = OFFLINE_FIXTURE_SOURCES.slice(0, limit);
    console.warn('FIRECRAWL_API_KEY not found. Running in fixture mode for reproducible QA.');
  } else {
    const search = await firecrawlRequest<FirecrawlSearchResponse>('search', apiKey, {
      query,
      limit,
    });

    if (!search.success || !search.data || search.data.length === 0) {
      throw new Error(`Firecrawl search returned no results for query: "${query}"`);
    }

    const selected = search.data.slice(0, limit);

    for (const item of selected) {
      try {
        const scrape = await firecrawlRequest<FirecrawlScrapeResponse>('scrape', apiKey, {
          url: item.url,
          formats: ['markdown'],
          onlyMainContent: true,
        });

        const markdown = (scrape.data?.markdown ?? '').trim();
        const title =
          scrape.data?.metadata?.title ?? item.title ?? scrape.data?.metadata?.sourceURL ?? item.url;

        scraped.push({
          url: item.url,
          title,
          snippet: markdown.slice(0, 280).replace(/\s+/g, ' '),
          markdownLength: markdown.length,
        });
      } catch (error) {
        scraped.push({
          url: item.url,
          title: item.title ?? item.url,
          snippet: '',
          markdownLength: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const successfulSources = scraped.filter((source) => !source.error && source.markdownLength > 0);
  if (successfulSources.length === 0) {
    throw new Error('All scrape attempts failed; no extractable source content was returned.');
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'reports', 'firecrawl-demo');
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, `${ts}.json`);
  const mdPath = join(outDir, `${ts}.md`);
  const htmlPath = join(outDir, `${ts}.html`);

  const payload = {
    generatedAt: new Date().toISOString(),
    mode,
    query,
    limit,
    sources: scraped,
    successfulSources: successfulSources.length,
  };

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const markdown = [
    '# Firecrawl Research Brief (gstack POC)',
    '',
    `- Generated: ${payload.generatedAt}`,
    `- Mode: ${mode}`,
    `- Query: ${query}`,
    `- Sources analyzed: ${scraped.length}`,
    `- Sources successfully scraped: ${successfulSources.length}`,
    '',
    '## Top sources',
    ...scraped.flatMap((source, index) => [
      '',
      `### ${index + 1}. ${source.title}`,
      `- URL: ${source.url}`,
      `- Extracted markdown length: ${source.markdownLength} chars`,
      ...(source.error
        ? [`- Scrape status: ⚠️ ${source.error}`]
        : [`- Scrape status: ✅ success`, `- Snippet: ${source.snippet || '_No extractable content returned_'}...`]),
    ]),
    '',
    '## Why this maps well to gstack',
    '- Gives `/office-hours` and planning skills structured, fresh market/technical context before implementation starts.',
    '- Produces auditable evidence artifacts (`reports/firecrawl-demo/*.md|json`) that can be attached to ticket workflows.',
    '- Complements the existing `/browse` tool: Firecrawl excels at multi-page extraction while `/browse` excels at deterministic interaction.',
    ...(mode === 'fixture'
      ? [
          '- QA note: this run used fixture mode because FIRECRAWL_API_KEY was unavailable; use a key for live API validation.',
        ]
      : []),
    '',
    `JSON artifact: ${jsonPath}`,
  ].join('\n');

  writeFileSync(mdPath, markdown);

  const html = renderHtmlBrief({
    query,
    mode,
    generatedAt: payload.generatedAt,
    sources: scraped,
    successfulSources: successfulSources.length,
    jsonPath,
  });

  writeFileSync(htmlPath, html);

  console.log(`Firecrawl POC complete.`);
  console.log(`- Markdown brief: ${mdPath}`);
  console.log(`- JSON artifact: ${jsonPath}`);
  console.log(`- HTML stakeholder brief: ${htmlPath}`);
}

main().catch((error) => {
  console.error(`firecrawl-demo failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
