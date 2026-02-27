/**
 * web-fetch.ts — fetches a URL and returns its text content.
 * HTML is stripped to plain text. JSON is pretty-printed.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const DEFAULT_MAX_CHARS = 12000;

function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
		.replace(/<svg[\s\S]*?<\/svg>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export const webFetchTool: ToolDefinition = {
	name: "web_fetch",
	label: "Web Fetch",
	description:
		"Fetch the text content of any URL. HTML is stripped to readable text. Useful for reading documentation, articles, blog posts, GitHub issues, and other web pages.",
	parameters: Type.Object({
		url: Type.String({ description: "The URL to fetch." }),
		maxChars: Type.Optional(
			Type.Number({
				description: `Maximum characters to return. Default: ${DEFAULT_MAX_CHARS}`,
			}),
		),
	}),

	async execute(_id, params:any, signal, _onUpdate, _ctx) {
		const limit = params.maxChars ?? DEFAULT_MAX_CHARS;
		let text: string;
		let status: number;

		try {
			const res = await fetch(params.url, {
				signal,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					Accept: "text/html,application/xhtml+xml,application/json,text/plain,*/*",
					"Accept-Language": "en-US,en;q=0.9",
				},
			});

			status = res.status;

			if (!res.ok) {
				const body = await res.text().catch(() => "");
				return {
					content: [
						{
							type: "text" as const,
							text: `HTTP ${res.status} ${res.statusText}\n${body.slice(0, 500)}`,
						},
					],
					details: { url: params.url, status: res.status, ok: false },
				};
			}

			const contentType = res.headers.get("content-type") ?? "";
			if (contentType.includes("application/json")) {
				const json = await res.json();
				text = JSON.stringify(json, null, 2);
			} else {
				const raw = await res.text();
				text = contentType.includes("html") ? stripHtml(raw) : raw;
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text" as const, text: `Fetch error: ${msg}` }],
				details: { url: params.url, error: msg, ok: false },
			};
		}

		const truncated =
			text.length > limit ? `${text.slice(0, limit)}\n\n[...truncated — ${text.length - limit} chars omitted]` : text;

		return {
			content: [{ type: "text" as const, text: truncated }],
			details: { url: params.url, status, length: text.length, truncated: text.length > limit },
		};
	},
};
