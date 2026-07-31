/**
 * MarkdownMath组件。封装可复用的界面结构、展示规则及交互行为。
 */
import katex from "katex";
import type { ReactNode } from "react";

/**
 * MarkdownMathProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface MarkdownMathProps {
  value?: string;
  className?: string;
  convertInlineCodeToMath?: boolean;
}

/**
 * Block类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type Block =
  | { type: "code"; content: string; language: string }
  | { type: "math"; content: string }
  | { type: "text"; lines: string[] };

/**
 * 渲染Latex。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function renderLatex(content: string, displayMode: boolean) {
  const html = katex.renderToString(normalizeLatexContent(content), {
    displayMode,
    throwOnError: false,
    strict: false,
  });
  return (
    <span
      className={displayMode ? "markdown-math__display" : "markdown-math__inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * 解析并规范化LatexContent。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function normalizeLatexContent(content: string) {
  return content
    .replace(/\\abs\s*\{([^{}]+)\}/g, "\\left|$1\\right|")
    .replace(/\\abs\s*\(([^()]+)\)/g, "\\left|$1\\right|")
    .replace(/(?<![A-Za-z\\])abs\s*\(([^()]+)\)/g, "\\left|$1\\right|")
    .replace(/\\bmod\s*/g, "\\bmod ")
    .replace(/(?<![A-Za-z\\])mod\s*/g, "\\bmod ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATH_FUNCTION_NAMES = new Set([
  "abs",
  "ceil",
  "det",
  "deg",
  "exp",
  "floor",
  "gcd",
  "lcm",
  "lg",
  "lim",
  "ln",
  "log",
  "max",
  "min",
  "mod",
  "Pr",
  "pow",
  "sqrt",
  "sin",
  "cos",
  "tan",
]);

const LATEX_FUNCTION_NAMES = new Set([
  "cos",
  "det",
  "exp",
  "gcd",
  "lim",
  "ln",
  "log",
  "max",
  "min",
  "Pr",
  "sin",
  "sqrt",
  "tan",
]);

const OPERATOR_FUNCTION_NAMES = new Set(["deg", "lcm", "lg", "pow"]);

const CODE_KEYWORDS = /\b(?:int|long|short|float|double|char|bool|string|void|return|main|namespace|using|class|struct|template|include|for|while|if|else|switch|case|break|continue|const|auto|public|private|protected|static|new|delete|cin|cout|printf|scanf|vector|map|set|unordered_map|unordered_set|pair|size_t|nullptr|std::)\b/;

/**
 * 解析并规范化Inline编码Math。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function normalizeInlineCodeMath(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 80 || trimmed.includes("\n")) {
    return null;
  }
  if (CODE_KEYWORDS.test(trimmed)) {
    return null;
  }

  const simpleIdentifier = /^[A-Za-z]$|^[A-Za-z][A-Za-z0-9_]{0,5}$/;
  const mathExpression = /^[A-Za-z0-9\s+\-*/%^=<>!&|.,():_[\]{}\\]+$/;
  const complexityExpression = /^O\s*\([A-Za-z0-9\s+\-*/%^=<>!(),_\\]+\)$/;
  if (!simpleIdentifier.test(trimmed) && !mathExpression.test(trimmed)) {
    return null;
  }

  const leadingFunctionName = (trimmed.split(/[(\s]/, 1)[0] ?? "").replace(/^\\/, "");
  const hasMathSignal =
    simpleIdentifier.test(trimmed) ||
    complexityExpression.test(trimmed) ||
    /[=<>^+\-*/%]/.test(trimmed) ||
    MATH_FUNCTION_NAMES.has(leadingFunctionName);
  if (!hasMathSignal) {
    return null;
  }

  let normalized = normalizeLatexContent(trimmed)
    .replace(/\bceil\s*\(([^()]*)\)/g, "\\lceil $1 \\rceil")
    .replace(/\bfloor\s*\(([^()]*)\)/g, "\\lfloor $1 \\rfloor")
    .replace(/\b([A-Za-z][A-Za-z0-9_]*)\s*\(/g, (match, name: string) => {
      if (LATEX_FUNCTION_NAMES.has(name)) {
        return `\\${name}(`;
      }
      if (OPERATOR_FUNCTION_NAMES.has(name)) {
        return `\\operatorname{${name}}(`;
      }
      return match;
    })
    .replace(/==/g, "=")
    .replace(/!=/g, "\\ne ")
    .replace(/<=/g, "\\le ")
    .replace(/>=/g, "\\ge ")
    .replace(/&&/g, "\\land ")
    .replace(/\|\|/g, "\\lor ")
    .replace(/%/g, "\\bmod ")
    .replace(/\\bmod\s*/g, "\\bmod ")
    .replace(/(?<![A-Za-z\\])mod\s*/g, "\\bmod ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized;
}

const AUTO_MATH_TEXT_PATTERN =
  /\bO\s*\([^)]{1,80}\)|(?<![A-Za-z0-9_])(?:\\?[A-Za-z][A-Za-z0-9_]*\s*\([^)]{1,80}\)|[A-Za-z][A-Za-z0-9_]*|\d+(?:\.\d+)?|\([^)]+\))(?:\s*(?:<=|>=|!=|==|=|<|>|[+\-*/%^]|\\?b?mod)\s*(?:\\?[A-Za-z][A-Za-z0-9_]*\s*\([^)]{1,80}\)|[A-Za-z][A-Za-z0-9_]*|\d+(?:\.\d+)?|\([^)]+\)))+|\b(?:\\?abs|ceil|det|exp|floor|gcd|lcm|lg|lim|ln|log|max|min|pow|sqrt|sin|cos|tan)\s*\([^)]{1,80}\)|(?<![A-Za-z0-9_\\])([A-Za-z])(?![A-Za-z0-9_+])/g;

const MATH_CONTEXT_WORDS =
  /[变量公式约束复杂度范围区间整数正数负数倍数小于大于等于不等于至少至多取令设为和或满足选择不同相同当前当时其中共有]/;

/**
 * 判断shouldConvertPlainMath是否成立。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function shouldConvertPlainMath(text: string, start: number, end: number, candidate: string) {
  const trimmed = candidate.trim();
  if (!trimmed || CODE_KEYWORDS.test(trimmed)) {
    return false;
  }

  if (/^[A-Za-z]$/.test(trimmed)) {
    const before = text.slice(Math.max(0, start - 10), start);
    const after = text.slice(end, end + 10);
    if (trimmed === "C" && /^\s*(\+\+|语言|lang|language)/i.test(after)) {
      return false;
    }
    return /[=<>+\-*/%^]/.test(before + after) || MATH_CONTEXT_WORDS.test(before + after);
  }

  return true;
}

/**
 * 渲染PlainTextWithMath。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function renderPlainTextWithMath(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(AUTO_MATH_TEXT_PATTERN)) {
    const start = match.index ?? 0;
    const candidate = match[0];
    const end = start + candidate.length;
    if (start < lastIndex) {
      continue;
    }

    const normalized = shouldConvertPlainMath(text, start, end, candidate)
      ? normalizeInlineCodeMath(candidate)
      : null;
    if (!normalized) {
      continue;
    }

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <span key={`${keyPrefix}-auto-math-${matchIndex}`}>
        {renderLatex(normalized, false)}
      </span>,
    );
    lastIndex = end;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : [text];
}

/**
 * 封装splitBlocks相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function splitBlocks(value: string): Block[] {
  const lines = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: Block[] = [];
  let textLines: string[] = [];
  let index = 0;

  /**
   * 封装flushText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const flushText = () => {
    if (textLines.length) {
      blocks.push({ type: "text", lines: textLines });
      textLines = [];
    }
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushText();
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language, content: codeLines.join("\n") });
      index += 1;
      continue;
    }

    if (trimmed === "$$") {
      flushText();
      const mathLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "$$") {
        mathLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "math", content: mathLines.join("\n") });
      index += 1;
      continue;
    }

    if (trimmed === "\\[") {
      flushText();
      const mathLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "\\]") {
        mathLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "math", content: mathLines.join("\n") });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
      flushText();
      blocks.push({ type: "math", content: trimmed.slice(2, -2).trim() });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]") && trimmed.length > 4) {
      flushText();
      blocks.push({ type: "math", content: trimmed.slice(2, -2).trim() });
      index += 1;
      continue;
    }

    textLines.push(line);
    index += 1;
  }

  flushText();
  return blocks;
}

/**
 * 渲染Inline。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function renderInline(text: string, keyPrefix: string, convertInlineCodeToMath = false): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let textBuffer = "";

  /**
   * 封装flushText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const flushText = () => {
    if (textBuffer) {
      if (convertInlineCodeToMath) {
        nodes.push(...renderPlainTextWithMath(textBuffer, `${keyPrefix}-plain-${nodes.length}`));
      } else {
        nodes.push(textBuffer);
      }
      textBuffer = "";
    }
  };

  while (index < text.length) {
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end > index + 2) {
        flushText();
        nodes.push(
          <strong key={`${keyPrefix}-strong-${index}`}>
            {renderInline(text.slice(index + 2, end), `${keyPrefix}-strong-${index}`, convertInlineCodeToMath)}
          </strong>,
        );
        index = end + 2;
        continue;
      }
    }

    if (text[index] === "`") {
      const end = text.indexOf("`", index + 1);
      if (end > index + 1) {
        flushText();
        const rawCode = text.slice(index + 1, end);
        const mathCode = convertInlineCodeToMath ? normalizeInlineCodeMath(rawCode) : null;
        if (mathCode) {
          nodes.push(
            <span key={`${keyPrefix}-mathcode-${index}`}>
              {renderLatex(mathCode, false)}
            </span>,
          );
        } else {
          nodes.push(<code key={`${keyPrefix}-code-${index}`}>{rawCode}</code>);
        }
        index = end + 1;
        continue;
      }
    }

    if (text[index] === "$" && text[index + 1] !== "$") {
      const end = text.indexOf("$", index + 1);
      if (end > index + 1) {
        flushText();
        nodes.push(
          <span key={`${keyPrefix}-math-${index}`}>
            {renderLatex(text.slice(index + 1, end), false)}
          </span>,
        );
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith("\\(", index)) {
      const end = text.indexOf("\\)", index + 2);
      if (end > index + 2) {
        flushText();
        nodes.push(
          <span key={`${keyPrefix}-math-paren-${index}`}>
            {renderLatex(text.slice(index + 2, end), false)}
          </span>,
        );
        index = end + 2;
        continue;
      }
    }

    if (text[index] === "*" && text[index + 1] !== "*") {
      const end = text.indexOf("*", index + 1);
      if (end > index + 1) {
        flushText();
        nodes.push(
          <em key={`${keyPrefix}-em-${index}`}>
            {renderInline(text.slice(index + 1, end), `${keyPrefix}-em-${index}`, convertInlineCodeToMath)}
          </em>,
        );
        index = end + 1;
        continue;
      }
    }

    textBuffer += text[index];
    index += 1;
  }

  flushText();
  return nodes;
}

/**
 * 封装paragraphGroups相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function paragraphGroups(lines: string[]) {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) {
    groups.push(current);
  }
  return groups;
}

/**
 * 渲染TextBlock。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function renderTextBlock(lines: string[], keyPrefix: string, convertInlineCodeToMath = false) {
  return paragraphGroups(lines).map((group, groupIndex) => {
    const first = group[0].trim();
    const heading = first.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], `${keyPrefix}-h-${groupIndex}`, convertInlineCodeToMath);
      if (level === 1) return <h1 key={`${keyPrefix}-${groupIndex}`}>{content}</h1>;
      if (level === 2) return <h2 key={`${keyPrefix}-${groupIndex}`}>{content}</h2>;
      if (level === 3) return <h3 key={`${keyPrefix}-${groupIndex}`}>{content}</h3>;
      return <h4 key={`${keyPrefix}-${groupIndex}`}>{content}</h4>;
    }

    if (group.every((line) => /^\s*[-*]\s+/.test(line))) {
      return (
        <ul key={`${keyPrefix}-${groupIndex}`}>
          {group.map((line, lineIndex) => (
          <li key={`${keyPrefix}-${groupIndex}-${lineIndex}`}>
              {renderInline(
                line.replace(/^\s*[-*]\s+/, ""),
                `${keyPrefix}-li-${groupIndex}-${lineIndex}`,
                convertInlineCodeToMath,
              )}
            </li>
          ))}
        </ul>
      );
    }

    if (group.every((line) => /^\s*\d+\.\s+/.test(line))) {
      return (
        <ol key={`${keyPrefix}-${groupIndex}`}>
          {group.map((line, lineIndex) => (
          <li key={`${keyPrefix}-${groupIndex}-${lineIndex}`}>
              {renderInline(
                line.replace(/^\s*\d+\.\s+/, ""),
                `${keyPrefix}-ol-${groupIndex}-${lineIndex}`,
                convertInlineCodeToMath,
              )}
            </li>
          ))}
        </ol>
      );
    }

    if (group.every((line) => /^\s*>/.test(line))) {
      return (
        <blockquote key={`${keyPrefix}-${groupIndex}`}>
          {group.map((line, lineIndex) => (
          <p key={`${keyPrefix}-${groupIndex}-${lineIndex}`}>
              {renderInline(
                line.replace(/^\s*>\s?/, ""),
                `${keyPrefix}-quote-${groupIndex}-${lineIndex}`,
                convertInlineCodeToMath,
              )}
            </p>
          ))}
        </blockquote>
      );
    }

    return (
      <p key={`${keyPrefix}-${groupIndex}`}>
        {renderInline(group.join("\n"), `${keyPrefix}-p-${groupIndex}`, convertInlineCodeToMath)}
      </p>
    );
  });
}

/**
 * 渲染MarkdownMath组件，并协调其数据加载、状态和交互。
 */
export function MarkdownMath({ value = "", className, convertInlineCodeToMath = false }: MarkdownMathProps) {
  const blocks = splitBlocks(value);

  return (
    <div className={["markdown-math", className].filter(Boolean).join(" ")}>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <pre key={index} className="markdown-math__code">
              {block.language ? <span className="markdown-math__code-lang">{block.language}</span> : null}
              <code>{block.content}</code>
            </pre>
          );
        }
        if (block.type === "math") {
          return <div key={index}>{renderLatex(block.content, true)}</div>;
        }
        return renderTextBlock(block.lines, `block-${index}`, convertInlineCodeToMath);
      })}
    </div>
  );
}
