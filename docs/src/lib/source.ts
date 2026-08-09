import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { docsRoute } from "./shared";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [lucideIconsPlugin()],
});

export async function getLLMText(page: (typeof source)["$inferPage"]) {
  const processed = await page.data.getText("processed");
  const description = page.data.description?.trim();

  return [
    `# ${page.data.title}`,
    "",
    `Source: ${page.url}.md`,
    description ? `Summary: ${description}` : null,
    "",
    processed,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
