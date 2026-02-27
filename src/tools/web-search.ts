/**
 * web-search.ts — DuckDuckGo Lite search (no API key required).
 *
 * Scrapes https://lite.duckduckgo.com/lite/ for results and returns
 * a structured list of { title, url, snippet }.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const DDG_LITE = "https://lite.duckduckgo.com/lite/";
const DEFAULT_K = 8;

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

/**
 * Parse DuckDuckGo Lite HTML into search results.
 *
 * The page structure uses a table. Result rows alternate between a link row
 * (containing the title + href) and a snippet row.
 */
function parseDdgLite(html: string): SearchResult[] {
	const results: SearchResult[] = [];

	// Extract all result links: class="result-link"
	// href is a DDG redirect: //duckduckgo.com/l/?uddg=<encoded-url>
	const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
	// Snippets follow immediately after in a td with class "result-snippet"
	const snippetRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

	const links: Array<{ url: string; title: string }> = [];
	let m: RegExpExecArray | null;

	while ((m = linkRe.exec(html)) !== null) {
		const rawHref = m[1];
		const rawTitle = m[2];

		// Decode DDG redirect URL
		let url = rawHref;
		const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
		if (uddgMatch) {
			try {
				url = decodeURIComponent(uddgMatch[1]);
			} catch {
				url = rawHref;
			}
		} else if (rawHref.startsWith("//")) {
			url = `https:${rawHref}`;
		}

		const title = rawTitle
			.replace(/<[^>]+>/g, "")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.trim();

		if (title && url) links.push({ url, title });
	}

	const snippets: string[] = [];
	while ((m = snippetRe.exec(html)) !== null) {
		snippets.push(
			m[1]
				.replace(/<[^>]+>/g, "")
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, "'")
				.replace(/\s+/g, " ")
				.trim(),
		);
	}

	for (let i = 0; i < links.length; i++) {
		results.push({
			title: links[i].title,
			url: links[i].url,
			snippet: snippets[i] ?? "",
		});
	}

	return results;
}

export const webSearchTool: ToolDefinition = {
	name: "web_search",
	label: "Web Search",
	description:
		"Search the web via DuckDuckGo. Returns titles, URLs, and snippets for the top results. Use this to find current information, documentation, articles, or any web content.",
	parameters: Type.Object({
		query: Type.String({ description: "The search query." }),
		maxResults: Type.Optional(
			Type.Number({ description: `Maximum number of results to return. Default: ${DEFAULT_K}` }),
		),
	}),

	async execute(_id, params:any, signal, _onUpdate, _ctx) {
		const k = Math.min(params.maxResults ?? DEFAULT_K, 20);

		let html: string;
		try {
			const res = await fetch(`${DDG_LITE}?q=${encodeURIComponent(params.query)}`, {
				signal,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					Accept: "text/html,*/*",
					"Accept-Language": "en-US,en;q=0.9",
				},
				redirect: "follow",
			});

			if (!res.ok) {
				return {
					content: [{ type: "text" as const, text: `Search failed: HTTP ${res.status}` }],
					details: { query: params.query, error: `HTTP ${res.status}` },
				};
			}

			html = await res.text();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text" as const, text: `Search error: ${msg}` }],
				details: { query: params.query, error: msg },
			};
		}

		const results = parseDdgLite(html).slice(0, k);

		if (results.length === 0) {
			return {
				content: [{ type: "text" as const, text: "No results found." }],
				details: { query: params.query, count: 0, results: [] },
			};
		}

		const text = results
			.map(
				(r, i) =>
					`${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`,
			)
			.join("\n\n");

		return {
			content: [{ type: "text" as const, text }],
			details: { query: params.query, count: results.length, results },
		};
	},
};
