<script setup lang="ts">
import { computed, ref, watch } from "vue";
import katex from "katex";
import { sanitizeAnnouncementHtml } from "../../utils/announcementHtml";
import "katex/dist/katex.min.css";
import "../../styles/html-math.css";

const props = withDefaults(defineProps<{ value?: string; className?: string; emptyText?: string; preservePlainTextWhitespace?: boolean }>(), {
  value: "", className: "", emptyText: "", preservePlainTextWhitespace: false,
});
const host = ref<HTMLElement>();
const html = computed(() => sanitizeAnnouncementHtml(props.value || ""));

function nextFormula(text: string, from: number): { start: number; end: number; body: string; display: boolean } | null {
  const patterns = [/\$\$([\s\S]+?)\$\$/g, /\\\[([\s\S]+?)\\\]/g, /\\\(([\s\S]+?)\\\)/g, /(^|[^\\])\$([^\n$]+?)\$/g];
  let candidate: { start: number; end: number; body: string; display: boolean } | null = null;
  patterns.forEach((pattern, index) => {
    pattern.lastIndex = from;
    const match = pattern.exec(text);
    if (!match) return;
    const prefixLength = index === 3 ? match[1].length : 0;
    const found = { start: match.index + prefixLength, end: match.index + match[0].length, body: match[index === 3 ? 2 : 1], display: index < 2 };
    if (!candidate || found.start < candidate.start) candidate = found;
  });
  return candidate;
}
function renderMath() {
  const root = host.value;
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || !/[$\\]/.test(node.textContent)) return NodeFilter.FILTER_REJECT;
      let parent = node.parentElement;
      while (parent && parent !== root) {
        if (["CODE", "PRE", "KBD", "SAMP"].includes(parent.tagName) || parent.classList.contains("katex")) return NodeFilter.FILTER_REJECT;
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) targets.push(node as Text);
  targets.forEach((node) => {
    const text = node.textContent || "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let formula = nextFormula(text, cursor);
    if (!formula) return;
    while (formula) {
      if (formula.start > cursor) fragment.append(document.createTextNode(text.slice(cursor, formula.start)));
      const holder = document.createElement(formula.display ? "div" : "span");
      holder.className = formula.display ? "html-math__display" : "html-math__inline";
      try { holder.innerHTML = katex.renderToString(formula.body.trim(), { displayMode: formula.display, throwOnError: false, strict: false }); }
      catch { holder.textContent = text.slice(formula.start, formula.end); }
      fragment.append(holder);
      cursor = formula.end;
      formula = nextFormula(text, cursor);
    }
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    node.parentNode?.replaceChild(fragment, node);
  });
}
watch([html, host], renderMath, { flush: "post" });
</script>

<template>
  <div v-if="html.trim()" ref="host" class="html-math" :class="[className, preservePlainTextWhitespace ? 'html-math--plain-text' : '']" v-html="html" />
  <div v-else class="html-math html-math--empty" :class="className">{{ emptyText }}</div>
</template>
