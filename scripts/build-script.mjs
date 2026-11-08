/**
 * The plain-script build: one minified file a `<script>` tag can load. The framework variables
 * mean nothing there, so they are compiled away rather than looked for at run time.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/script.ts"],
  outfile: "dist/script.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2018",
  legalComments: "none",
  define: {
    "process.env.NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY": "undefined",
    "process.env.NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT": "undefined",
  },
});
