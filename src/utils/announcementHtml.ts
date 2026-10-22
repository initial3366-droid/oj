import DOMPurify from "dompurify";

const SAFE_INLINE_STYLE_PROPERTIES = [
  "color", "background-color", "font-weight", "font-style", "text-decoration",
  "text-align", "white-space", "max-width", "width", "height",
  "box-sizing", "background", "font-family", "font-size", "line-height", "letter-spacing",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-radius", "border-collapse", "table-layout",
] as const;
const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|@import|javascript:|var\s*\(/i;

/** Sanitize administrator-authored HTML before rendering it in the public UI. */
export function sanitizeAnnouncementHtml(value: string) {
  const sanitized = DOMPurify.sanitize(value ?? "", {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["srcset"],
  });
  const template = document.createElement("template");
  template.innerHTML = String(sanitized);

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const parsed = document.createElement("span");
    parsed.setAttribute("style", element.getAttribute("style") ?? "");
    const allowed: string[] = [];
    SAFE_INLINE_STYLE_PROPERTIES.forEach((property) => {
      const propertyValue = parsed.style.getPropertyValue(property).trim();
      if (propertyValue && !UNSAFE_STYLE_VALUE.test(propertyValue)) allowed.push(`${property}: ${propertyValue}`);
    });
    if (allowed.length > 0) element.setAttribute("style", allowed.join("; "));
    else element.removeAttribute("style");
  });

  template.content.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    link.setAttribute("rel", "noopener noreferrer");
    if (link.target !== "_blank") link.removeAttribute("target");
  });
  return template.innerHTML;
}

/** Convert sanitized rich content to plain text for compact announcement previews. */
export function announcementPlainText(value: string) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = sanitizeAnnouncementHtml(value);
  return (wrapper.textContent ?? "").replace(/\s+/g, " ").trim();
}
