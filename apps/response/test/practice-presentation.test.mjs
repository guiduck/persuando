import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { codeLanguage, emphasizeInterviewSpeech, fencedCode, isManualCheck } from "../src/lib/practice-presentation.mjs";

const render = (content) => renderToStaticMarkup(React.createElement(ReactMarkdown, { rehypePlugins: [rehypeHighlight], skipHtml: true }, content));

test("Legacy JSX cards infer their language and render real syntax tokens", () => {
  const code = "export default function App() { return <p title='products'>Products</p>; }";
  const html = render(fencedCode(code, codeLanguage(code, "Step 2 — replace src/App.jsx")));
  assert.match(html, /hljs-keyword/);
  assert.match(html, /hljs-string/);
  assert.match(html, /hljs-tag/);
  assert.equal(codeLanguage("", "src/App.tsx"), "typescript");
  assert.equal(codeLanguage("def select_products(items):\n    return items"), "python");
  assert.equal(codeLanguage("npm run build"), "bash");
});

test("Code fencing preserves embedded fences and HTML as literal code", () => {
  const code = 'const example = "```html\\n<img src=x onerror=alert(1)>";';
  const markdown = fencedCode(code, "javascript");
  assert.ok(markdown.startsWith("````javascript\n"));
  const html = render(markdown);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test("Manual checks use readable Markdown while actual tests retain code rendering", () => {
  assert.equal(isManualCheck({ testCode: "Manual UI checks:\n1. Search APPLE.\n2. Clear filters." }), true);
  assert.equal(isManualCheck({ testCode: "1. Search APPLE.", testKind: "manual" }), true);
  assert.equal(isManualCheck({ testCode: "assert.equal(selectProducts(items).length, 1);" }), false);
  assert.equal(isManualCheck({ testCode: "Manual is a variable", testKind: "code" }), false);
});

test("Legacy inline speech becomes a blockquote without losing its numbered explanation", () => {
  const markdown = emphasizeInterviewSpeech('1. **Current doubt** → Does data reach the UI? **Interview speech** → “I will check the smallest slice first.”');
  const html = render(markdown);
  assert.match(html, /<ol>/);
  assert.match(html, /Does data reach the UI/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<strong>Interview speech:<\/strong>/);
  assert.match(html, /smallest slice first/);
  assert.match(render(emphasizeInterviewSpeech('- **Fala para entrevista:** Vou validar os filtros.')), /<li>\s*<blockquote>/);
});

test("Speech normalization leaves existing quotes and code fences untouched", () => {
  const markdown = '> **Fala para entrevista:** Vou testar.\n\n```js\nconst label = "Interview speech: keep this string";\n```';
  assert.equal(emphasizeInterviewSpeech(markdown), markdown);
  assert.equal((render(emphasizeInterviewSpeech(markdown)).match(/<blockquote>/g) ?? []).length, 1);
});
