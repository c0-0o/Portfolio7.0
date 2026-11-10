function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\a ")
    .replace(/\r/g, "\\d ");
}

function tagName(element: Element): string {
  return element.tagName.toLowerCase();
}

function segmentFor(element: Element): string {
  const tag = tagName(element);
  const attributes = ["id", "data-testid", "aria-label", "name", "role", "title", "alt", "href"];
  for (const attribute of attributes) {
    const value = element.getAttribute(attribute);
    if (value) return `${tag}[${attribute}="${escapeCssString(value)}"]`;
  }
  const parent = element.parentElement;
  if (!parent) return tag;
  const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  return `${tag}:nth-of-type(${sameTagSiblings.indexOf(element) + 1})`;
}

function selectorFrom(anchor: Element, element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current !== anchor) {
    segments.unshift(segmentFor(current));
    current = current.parentElement;
  }
  segments.unshift(segmentFor(anchor));
  return segments.join(" > ");
}

export function createUniqueElementSelector(element: Element, root: Document = document): string | null {
  const candidates: Element[] = [];
  let current: Element | null = element;
  while (current && current !== root.body && current !== root.documentElement) {
    candidates.push(current);
    current = current.parentElement;
  }

  for (const anchor of candidates) {
    const selector = selectorFrom(anchor, element);
    if (root.querySelectorAll(selector).length === 1 && root.querySelector(selector) === element) return selector;
  }

  const fallback: string[] = [];
  current = element;
  while (current && current !== root.documentElement) {
    fallback.unshift(segmentFor(current));
    current = current.parentElement;
  }
  if (fallback.length === 0) return null;
  const selector = fallback.join(" > ");
  return root.querySelectorAll(selector).length === 1 && root.querySelector(selector) === element ? selector : null;
}

export function getTargetDisplayName(element: Element): string {
  const label = element.getAttribute("aria-label")
    || element.getAttribute("title")
    || element.getAttribute("alt")
    || (element as HTMLElement).innerText
    || element.textContent
    || "";
  const text = label.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 48) : tagName(element);
}
