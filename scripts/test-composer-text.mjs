/**
 * Zero-dependency tests for reading a composer draft with its line breaks intact.
 * Run via `npm test`. Uses hand-built node trees, so no DOM is needed.
 *
 * Regression: the old reader used `textContent`, which glued paragraphs together
 * ("line oneline two") and so mangled every multi-line message the wallet held.
 */
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/providers/composerText.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node18",
  logLevel: "silent",
});
const code = bundle.outputFiles[0].text;
const { readEditableText } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

// Tiny node builders: text("..."), el("p", ...children), br().
const text = (s) => ({ nodeType: 3, nodeValue: s });
const el = (tag, ...kids) => ({ nodeType: 1, tagName: tag.toUpperCase(), childNodes: kids });
const br = () => el("br");
const root = (...kids) => el("div", ...kids);
// What the old reader did, for the regression comparison.
const naiveTextContent = (n) =>
  n.nodeType === 3 ? n.nodeValue : (n.childNodes ?? []).map(naiveTextContent).join("");

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}

check("ProseMirror paragraphs become lines", () => {
  const composer = root(
    el("p", text("Here is my plan:")),
    el("p", text("first build the extension project")),
    el("p", text("then ship the extension project")),
  );
  assert.equal(
    readEditableText(composer),
    "Here is my plan:\nfirst build the extension project\nthen ship the extension project",
  );
});

check("regression: the old textContent reader glued the same paragraphs together", () => {
  const composer = root(el("p", text("Capital of France?")), el("p", text("And the capital of Spain?")));
  assert.equal(naiveTextContent(composer), "Capital of France?And the capital of Spain?");
  assert.equal(readEditableText(composer), "Capital of France?\nAnd the capital of Spain?");
});

check("an empty paragraph is a blank line", () => {
  const composer = root(el("p", text("a")), el("p", br()), el("p", text("b")));
  assert.equal(readEditableText(composer), "a\n\nb");
});

check("a hard break inside a paragraph is a line break", () => {
  assert.equal(readEditableText(root(el("p", text("a"), br(), text("b")))), "a\nb");
});

check("an empty composer (lone trailing <br>) reads as empty", () => {
  assert.equal(readEditableText(root(el("p", br()))), "");
  assert.equal(readEditableText(root()), "");
});

check("hard break at the end of a paragraph keeps one newline, trims to the text", () => {
  const composer = root(el("p", text("a"), br(), br()));
  assert.equal(readEditableText(composer), "a\n");
  assert.equal(readEditableText(composer).trim(), "a");
});

check("plain contenteditable: text, <div> lines and <br> all split", () => {
  assert.equal(readEditableText(root(text("line1"), el("div", text("line2")), el("div", text("line3")))), "line1\nline2\nline3");
  assert.equal(readEditableText(root(text("a"), br(), text("b"))), "a\nb");
});

check("nested blocks do not add stray blank lines", () => {
  assert.equal(readEditableText(root(el("div", el("p", text("a")), el("p", text("b"))))), "a\nb");
});

check("list items are one line each", () => {
  assert.equal(readEditableText(root(el("ul", el("li", text("a")), el("li", text("b"))))), "a\nb");
});

check("inline formatting does not split a line", () => {
  assert.equal(readEditableText(root(el("p", text("Hello "), el("strong", text("wor")), text("ld")))), "Hello world");
});

check("a single-line draft is unchanged", () => {
  const q = "What stack should I use for my browser extension project?";
  assert.equal(readEditableText(root(el("p", text(q)))), q);
});

console.log(`\n[composer-text] OK — ${passed} checks passed\n`);
