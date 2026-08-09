import { createFileRoute } from "@tanstack/react-router";
import { getLLMText, source } from "@/lib/source";
import { decodeMarkdownUrl } from "@/lib/shared";

export const Route = createFileRoute("/docs/{$}.md")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = decodeMarkdownUrl(params._splat?.split("/") ?? []);
        const page = source.getPage(slugs);
        if (!page) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(await getLLMText(page), {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          },
        });
      },
    },
  },
});
