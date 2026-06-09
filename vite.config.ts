// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

// Pin React Email's htmlparser2 dependency to entities@4.5.0 — v5+ removed
// the `entities/lib/decode.js` subpath that React Email uses.
const entitiesRoot = path.resolve(process.cwd(), "node_modules/entities");

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^entities\/lib\/decode\.js$/, replacement: path.join(entitiesRoot, "lib/decode.js") },
        { find: /^entities\/lib\/encode\.js$/, replacement: path.join(entitiesRoot, "lib/encode.js") },
        { find: /^entities$/, replacement: entitiesRoot },
      ],
    },
  },
});
