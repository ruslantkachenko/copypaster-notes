import assert from "node:assert/strict";
import test from "node:test";
import { BlogTagFilter } from "./components.js";

const TagFilter = BlogTagFilter();
const css = TagFilter.css;

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}"));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

test("tag cloud chips use the same light-gray palette as tags in full posts", () => {
  const rule = ruleBody(".blog-tag-filter__button");
  assert.match(rule, /background:\\s*var\\(--lightgray\\)/);
  assert.match(rule, /color:\\s*var\\(--dark\\)/);
  assert.match(rule, /font-family:\\s*var\\(--bodyFont\\)/);
  assert.match(rule, /font-size:\\s*0\\.88rem/);
  assert.match(rule, /font-weight:\\s*400/);
  assert.match(rule, /padding:\\s*0\\.16rem 0\\.65rem/);
  assert.match(rule, /border-radius:\\s*999px/);
});

test("selected tag cloud chips keep the same palette and use an outline for state", () => {
  const rule = ruleBody(".blog-tag-filter__button.is-active");
  assert.match(rule, /background:\\s*var\\(--lightgray\\)/);
  assert.match(rule, /color:\\s*var\\(--dark\\)/);
  assert.match(rule, /outline:\\s*1px solid var\\(--darkgray\\)/);
});
