import assert from "node:assert/strict";
import { test } from "node:test";

import { formatJson } from "./format-json.js";

void test("formatJson keeps short primitive arrays inline and objects expanded", () => {
  assert.equal(
    formatJson({
      $schema: "https://opencode.ai/config.json",
      instructions: ["AGENTS.md", ".agent/playbooks/*.md"],
      mcp: { shadcn: { type: "local", command: ["npx", "shadcn@latest", "mcp"] } },
      empty: {},
      none: [],
    }),
    [
      "{",
      '  "$schema": "https://opencode.ai/config.json",',
      '  "instructions": ["AGENTS.md", ".agent/playbooks/*.md"],',
      '  "mcp": {',
      '    "shadcn": {',
      '      "type": "local",',
      '      "command": ["npx", "shadcn@latest", "mcp"]',
      "    }",
      "  },",
      '  "empty": {},',
      '  "none": []',
      "}",
      "",
    ].join("\n"),
  );
});

void test("formatJson expands arrays that exceed the print width or hold objects", () => {
  const long = [
    "docs/**",
    "tech-stack-architecture-guide/**",
    "**/node_modules/**",
    "**/.turbo/**",
  ];
  assert.equal(
    formatJson({ ignorePatterns: long, list: [{ a: 1 }] }),
    [
      "{",
      '  "ignorePatterns": [',
      '    "docs/**",',
      '    "tech-stack-architecture-guide/**",',
      '    "**/node_modules/**",',
      '    "**/.turbo/**"',
      "  ],",
      '  "list": [',
      "    {",
      '      "a": 1',
      "    }",
      "  ]",
      "}",
      "",
    ].join("\n"),
  );
});
