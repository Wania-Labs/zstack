import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import appCss from "@/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "Cloudflare-first TypeScript product starter. Auth, billing, staff console, email, AI, and infrastructure wired, every vendor off until you add a key.",
      },
      { title: "zstack — launch lean, graduate without a rewrite" },
      { property: "og:title", content: "zstack" },
      {
        property: "og:description",
        content:
          "Cloudflare-first TypeScript product starter your coding agent already understands.",
      },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#f9f8f6", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#111719", media: "(prefers-color-scheme: dark)" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <RootProvider>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
