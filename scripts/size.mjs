/**
 * What each entry costs a site, minified and gzipped, once its bundler has removed what it doesn't
 * use. React and Next are the site's own, so they aren't counted.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const ENTRIES = ["index", "react", "next", "server", "vitals", "opt-out"];
const SITE_OWN = ["react", "react-dom", "react/jsx-runtime", "next"];

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;

for (const entry of ENTRIES) {
  const { outputFiles } = await build({
    entryPoints: [`dist/${entry}.js`],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    external: SITE_OWN,
    logLevel: "silent",
  });
  const code = outputFiles[0].contents;
  console.log(
    `${entry.padEnd(8)} ${kilobytes(code.length).padStart(9)} min ${kilobytes(gzipSync(code).length).padStart(9)} gzip`,
  );
}

const script = readFileSync("dist/script.js");
console.log(
  `${"script".padEnd(8)} ${kilobytes(script.length).padStart(9)} min ${kilobytes(gzipSync(script).length).padStart(9)} gzip`,
);
