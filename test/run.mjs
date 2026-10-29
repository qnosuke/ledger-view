import { build } from "esbuild";
import { readFile } from "node:fs/promises";

// Bundle the pure tokenizer, then exercise it against sample.ledger.
await build({
  entryPoints: ["src/tokenizer.ts"],
  bundle: true,
  format: "esm",
  outfile: "/tmp/olg-tokenizer.mjs",
  platform: "neutral",
  logLevel: "silent",
});

const { tokenizeDoc, CLS } = await import("/tmp/olg-tokenizer.mjs");

const src = await readFile("sample.ledger", "utf8");
const rawLines = src.split("\n");
const lines = [];
let off = 0;
for (const text of rawLines) {
  lines.push({ from: off, text });
  off += text.length + 1;
}

const spans = tokenizeDoc(lines);

// --- invariant checks -------------------------------------------------------
let failures = [];
let prev = null;
for (const s of spans) {
  if (s.to <= s.from) failures.push(`empty span ${JSON.stringify(s)}`);
  if (prev && s.from < prev.to) failures.push(`overlap at ${s.from}: ${prev.cls} vs ${s.cls}`);
  if (prev && s.from < prev.from) failures.push(`unsorted at ${s.from}`);
  prev = s;
}

// --- expectation checks -----------------------------------------------------
const textAt = (s) => src.slice(s.from, s.to);
const findSpan = (cls, substring) =>
  spans.find((s) => s.cls === cls && textAt(s).includes(substring));

const expects = [
  [CLS.comment, "サンプル家計簿"],
  [CLS.date, "2024/04/01"],
  [CLS.date, "2024/05/02"],       // effective date
  [CLS.amount, "100,000"],
  [CLS.amount, "-100,000"],
  [CLS.currency, "JPY"],
  [CLS.currency, "USD"],
  [CLS.account, "Assets:Bank:ゆうちょ"],
  [CLS.accountVirtual, "Equity:仮想勘定"],
  [CLS.accountVirtual, "Assets:集計用"],
  [CLS.keyword, "account"],
  [CLS.keyword, "commodity"],
  [CLS.keyword, "include"],
  [CLS.keywordControl, "payee"],
  [CLS.variable, "ゆうちょ銀行"],
  [CLS.regexp, "Expenses:食費 > 10000"],
  [CLS.desc, "初期残高の設定"],
  [CLS.descPending, "スーパーで買い物"],
  [CLS.comment, "ブロックコメントの中は"],
];
for (const [cls, needle] of expects) {
  const hit = findSpan(cls, needle);
  if (!hit) failures.push(`missing ${cls} span containing "${needle}"`);
}

// --- report -----------------------------------------------------------------
const counts = {};
for (const s of spans) counts[s.cls] = (counts[s.cls] ?? 0) + 1;

console.log("span counts by class:");
for (const [cls, n] of Object.entries(counts).sort()) {
  console.log(`  ${cls.padEnd(28)} ${n}`);
}

// ANSI preview of the first lines for a quick visual check.
const COLORS = {
  [CLS.comment]: "\x1b[32m",
  [CLS.date]: "\x1b[38;5;209m",
  [CLS.amount]: "\x1b[38;5;151m",
  [CLS.currency]: "\x1b[0m",
  [CLS.keyword]: "\x1b[38;5;75m",
  [CLS.keywordControl]: "\x1b[38;5;176m",
  [CLS.variable]: "\x1b[38;5;117m",
  [CLS.regexp]: "\x1b[38;5;167m",
  [CLS.account]: "\x1b[1m",
  [CLS.accountVirtual]: "\x1b[3m",
  [CLS.desc]: "\x1b[3m",
  [CLS.descPending]: "\x1b[4m",
};
const RESET = "\x1b[0m";
const previewLineCount = Math.min(rawLines.length, 24);
console.log("\n--- preview (first " + previewLineCount + " lines) ---");
for (let li = 0; li < previewLineCount; li++) {
  const line = lines[li];
  const lineSpans = spans.filter((s) => s.from >= line.from && s.to <= line.from + line.text.length);
  let out = "";
  let pos = line.from;
  for (const s of lineSpans) {
    if (s.from > pos) out += src.slice(pos, s.from);
    const color = COLORS[s.cls] ?? "";
    out += color + src.slice(s.from, s.to) + (color ? RESET : "");
    pos = s.to;
  }
  out += src.slice(pos, line.from + line.text.length);
  console.log(out);
}

if (failures.length) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\nAll tokenizer checks passed.");
