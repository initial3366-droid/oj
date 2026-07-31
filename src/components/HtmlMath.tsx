/**
 * HtmlMath组件。将题目描述等富文本按「HTML + LaTeX」渲染：
 * 先用 DOMPurify 清洗 HTML，再在安全 DOM 中把 $...$ / $$...$$ / \(...\) / \[...\]
 * 形式的 LaTeX 公式交给 KaTeX 渲染。用于题目描述、输入格式、输出格式等展示与预览。
 */
import DOMPurify from "dompurify";
import katex from "katex";
import { useMemo } from "react";
import "../styles/html-math.css";

/**
 * HtmlMathProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface HtmlMathProps {
  value?: string;
  className?: string;
  emptyText?: string;
}

const ALLOWED_TAGS = [
  "a", "b", "blockquote", "br", "code", "col", "colgroup", "del", "div", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
  "ins", "kbd", "li", "mark", "ol", "p", "pre", "s", "samp", "small", "span",
  "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr",
  "u", "ul", "var",
];

const ALLOWED_ATTR = ["class", "href", "src", "alt", "title", "target", "rel", "colspan", "rowspan", "align", "style"];

const SAFE_INLINE_STYLE_PROPERTIES = [
  "color", "background-color", "font-weight", "font-style", "text-decoration",
  "text-align", "white-space",
] as const;

const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|@import|javascript:|var\s*\(/i;

/**
 * 清洗富文本 HTML，限制标签/属性与内联样式，避免脚本注入与破坏页面布局。
 */
function sanitizeHtml(value: string) {
  const sanitized = DOMPurify.sanitize(value ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["srcset", "onerror", "onload"],
  });
  const template = document.createElement("template");
  template.innerHTML = String(sanitized);

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const parsed = document.createElement("span");
    parsed.setAttribute("style", element.getAttribute("style") ?? "");
    const allowed: string[] = [];
    SAFE_INLINE_STYLE_PROPERTIES.forEach((property) => {
      const propertyValue = parsed.style.getPropertyValue(property).trim();
      if (propertyValue && !UNSAFE_STYLE_VALUE.test(propertyValue)) {
        allowed.push(`${property}: ${propertyValue}`);
      }
    });
    if (allowed.length > 0) {
      element.setAttribute("style", allowed.join("; "));
    } else {
      element.removeAttribute("style");
    }
  });

  template.content.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.setAttribute("rel", "noopener noreferrer");
    if (link.target !== "_blank") {
      link.removeAttribute("target");
    }
  });

  return template;
}

/** 不参与 LaTeX 解析的元素（其内部文本按原样保留）。 */
const MATH_SKIP_TAGS = new Set(["CODE", "PRE", "KBD", "SAMP"]);

/**
 * 依次匹配文本中的 LaTeX 片段：$$...$$、\[...\]（块级）与 $...$、\(...\)（行内）。
 * 返回 null 表示该段文本不含公式。
 */
function findMath(text: string, from: number): { start: number; end: number; content: string; display: boolean } | null {
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\" && (text[i + 1] === "$" || text[i + 1] === "(" || text[i + 1] === "[")) {
      if (text[i + 1] === "(") {
        const close = text.indexOf("\\)", i + 2);
        if (close > i + 1) return { start: i, end: close + 2, content: text.slice(i + 2, close), display: false };
      } else if (text[i + 1] === "[") {
        const close = text.indexOf("\\]", i + 2);
        if (close > i + 1) return { start: i, end: close + 2, content: text.slice(i + 2, close), display: true };
      } else {
        // 转义的 \$，跳过下一个字符，不作为公式
        i += 1;
      }
      continue;
    }
    if (ch === "$") {
      if (text[i + 1] === "$") {
        const close = text.indexOf("$$", i + 2);
        if (close > i + 1) return { start: i, end: close + 2, content: text.slice(i + 2, close), display: true };
      } else {
        const close = text.indexOf("$", i + 1);
        if (close > i) return { start: i, end: close + 1, content: text.slice(i + 1, close), display: false };
      }
    }
  }
  return null;
}

/** 用 KaTeX 把一段公式渲染为 HTML 字符串，失败时回退为纯文本。 */
function renderKatex(content: string, display: boolean) {
  try {
    return katex.renderToString(content.trim(), {
      displayMode: display,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return "";
  }
}

/** 遍历安全 DOM 的文本节点，把其中的 LaTeX 片段替换为 KaTeX 渲染结果。 */
function renderMathInDom(root: DocumentFragment) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let parent = node.parentElement;
      while (parent) {
        if (MATH_SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        parent = parent.parentElement;
      }
      return node.textContent && /[$\\]/.test(node.textContent)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const targets: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    targets.push(current as Text);
    current = walker.nextNode();
  }

  targets.forEach((textNode) => {
    const text = textNode.textContent ?? "";
    const match = findMath(text, 0);
    if (!match) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let found: ReturnType<typeof findMath> = match;
    while (found) {
      if (found.start > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, found.start)));
      }
      const html = renderKatex(found.content, found.display);
      if (html) {
        const holder = document.createElement(found.display ? "div" : "span");
        holder.className = found.display ? "html-math__display" : "html-math__inline";
        holder.innerHTML = html;
        fragment.appendChild(holder);
      } else {
        fragment.appendChild(document.createTextNode(text.slice(found.start, found.end)));
      }
      cursor = found.end;
      found = findMath(text, cursor);
    }
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  });
}

/**
 * 渲染HtmlMath组件：清洗 HTML 并渲染其中的 LaTeX 公式，最终以 dangerouslySetInnerHTML 输出。
 */
export function HtmlMath({ value = "", className, emptyText = "" }: HtmlMathProps) {
  const html = useMemo(() => {
    const template = sanitizeHtml(value);
    renderMathInDom(template.content);
    return template.innerHTML;
  }, [value]);

  if (!html.trim()) {
    return <div className={["html-math", "html-math--empty", className].filter(Boolean).join(" ")}>{emptyText}</div>;
  }

  return (
    <div
      className={["html-math", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
