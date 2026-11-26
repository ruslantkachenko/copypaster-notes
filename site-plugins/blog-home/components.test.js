import assert from "node:assert/strict";
import test from "node:test";
import { BlogTagFilter } from "./components.js";

const TagFilter = BlogTagFilter();
const css = TagFilter.css;

function ruleBody(selector) {
  const start = css.indexOf(selector);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  assert.ok(start >= 0 && open > start && close > open, "Missing CSS rule: " + selector);
  return css.slice(open + 1, close);
}

test("tag cloud chips use the same light-gray palette as tags in full posts", () => {
  const rule = ruleBody(".blog-tag-filter__button");
  assert.match(rule, /background:\s*var\(--lightgray\)/);
  assert.match(rule, /color:\s*var\(--dark\)/);
  assert.match(rule, /font-family:\s*var\(--bodyFont\)/);
  assert.match(rule, /font-size:\s*0\.88rem/);
  assert.match(rule, /font-weight:\s*400/);
  assert.match(rule, /padding:\s*0\.16rem 0\.65rem/);
  assert.match(rule, /border-radius:\s*999px/);
});

test("selected tag cloud chips keep the same palette and use an outline for state", () => {
  const rule = ruleBody(".blog-tag-filter__button.is-active");
  assert.match(rule, /background:\s*var\(--lightgray\)/);
  assert.match(rule, /color:\s*var\(--dark\)/);
  assert.match(rule, /outline:\s*1px solid var\(--darkgray\)/);
});
