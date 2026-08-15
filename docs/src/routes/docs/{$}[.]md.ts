import { createFileRoute } from "@tanstack/react-router";
import { getLLMText, source } from "@/lib/source";
import { decodeMarkdownUrl } from "@/lib/shared";

const MD_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, max-age=60",
} as const;

export const Route = createFileRoute("/docs/{$}.md")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = decodeMarkdownUrl(params._splat?.split("/") ?? []);
        const page = source.getPage(slugs);
        if (!page) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(await getLLMText(page), { headers: MD_HEADERS });
      },
      HEAD({ params }) {
        const slugs = decodeMarkdownUrl(params._splat?.split("/") ?? []);
        const page = source.getPage(slugs);
        if (!page) {
          return new Response(null, { status: 404 });
        }
        return new Response(null, { headers: MD_HEADERS });
      },
    },
  },
});
