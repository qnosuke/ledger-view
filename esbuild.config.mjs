import esbuild from "esbuild";
import process from "process";

// OUTFILE=./path/main.js node esbuild.config.mjs — deploy straight to a vault.
const outfile = process.env.OUTFILE || "main.js";

const banner = `/*
Obsidian Ledger Viewer — syntax grammar ported from the VSCode extension
"vscode-ledger" by Mario Sangiorgio (MIT License); color palette follows
VSCode's default Dark+ / Light+ themes.
*/
`;

// CodeMirror packages stay external under their real names: Obsidian's plugin
// loader resolves them to the app's bundled CM6 copy (see obsidian-sample-plugin).
await esbuild.build({
  banner: { js: banner },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/language",
    "@codemirror/search",
    "@codemirror/commands",
    "@codemirror/autocomplete",
    "@codemirror/lint",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: "inline",
  treeShaking: true,
  outfile,
  platform: "node",
});

console.log(`build finished: ${outfile}`);
