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

  console.log(`Firecrawl POC complete.`);
  console.log(`- Markdown brief: ${mdPath}`);
  console.log(`- JSON artifact: ${jsonPath}`);
}

main().catch((error) => {
  console.error(`firecrawl-demo failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
