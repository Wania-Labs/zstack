import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { CopyPromptButton, GetStarted } from "@/components/get-started";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    GetStarted,
    CopyPromptButton,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
