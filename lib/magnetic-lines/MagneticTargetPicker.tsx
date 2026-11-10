"use client";

import { useEffect } from "react";
import { createUniqueElementSelector, getTargetDisplayName } from "./engine/targetSelector";

interface TargetPickerMessage {
  type: "magnetic-target-picked" | "magnetic-target-pick-cancelled" | "magnetic-target-pick-error" | "magnetic-target-preview";
  token: string;
  selector?: string;
  name?: string;
  tagName?: string;
  previewSvg?: string;
  previewToken?: string;
  targetId?: string;
  message?: string;
}

function isSelectableElement(element: Element | null): element is HTMLElement | SVGElement {
  if (!element || element === document.body || element === document.documentElement) return false;
  if (element.closest("[data-magnetic-target-picker]")) return false;
  if (element.closest("script, style, link, meta, title")) return false;
  return true;
}

function getPreferredTarget(element: Element): Element {
  const interactive = element.closest("button, a, input, select, textarea, [role], [data-testid], h1, h2, h3, h4, h5, h6, p, li, img");
  if (interactive && isSelectableElement(interactive)) return interactive;
  const svg = element.closest("svg");
  return svg && isSelectableElement(svg) ? svg : element;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character]!);
}

function createElementPreviewSvg(element: Element): string {
  const svgRoot = element instanceof SVGSVGElement ? element : element.closest("svg");
  if (svgRoot) {
    const clone = svgRoot.cloneNode(true) as SVGSVGElement;
    const originals = [svgRoot, ...Array.from(svgRoot.querySelectorAll("*"))];
    const copies = [clone, ...Array.from(clone.querySelectorAll("*"))];
    const safeColor = (value: string) => /^(none|#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+)$/i.test(value);
    for (let index = 0; index < copies.length; index++) {
      const copy = copies[index];
      for (const attribute of Array.from(copy.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on") || (name === "href" && !attribute.value.startsWith("#")) || /url\((?!["']?#)/i.test(attribute.value)) {
          copy.removeAttribute(attribute.name);
        }
      }
      const source = originals[index];
      if (!source) continue;
      const computed = window.getComputedStyle(source);
      for (const property of ["fill", "stroke", "color", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-opacity", "stroke-opacity", "opacity"] as const) {
        const value = computed.getPropertyValue(property);
        if (value && (property === "stroke-width" || property.endsWith("opacity") || safeColor(value))) {
          (copy as SVGElement).style.setProperty(property, value);
        }
      }
    }
    clone.querySelectorAll("script, foreignObject, iframe, object, embed, style").forEach((node) => node.remove());
    clone.setAttribute("width", "128");
    clone.setAttribute("height", "128");
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const markup = new XMLSerializer().serializeToString(clone);
    if (markup.length <= 32000) return markup;
  }

  const label = (element.getAttribute("aria-label")
    || element.getAttribute("alt")
    || (element as HTMLElement).innerText
    || element.textContent
    || element.tagName).replace(/\s+/g, " ").trim().slice(0, 48);
  const words = label.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > 15) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
    if (lines.length === 3) break;
  }
  if (line && lines.length < 4) lines.push(line);
  const text = lines.map((item, index) => `<text x="64" y="${59 + index * 16}" text-anchor="middle" fill="#e8f4f7" font-family="Arial,sans-serif" font-size="12">${escapeXml(item)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="1" y="1" width="126" height="126" rx="12" fill="#14212a" stroke="#4c7887"/><path d="M24 28h80" stroke="#5ee6ff" stroke-width="2" opacity=".8"/><text x="64" y="47" text-anchor="middle" fill="#83b9c3" font-family="monospace" font-size="9">${escapeXml(element.tagName.toLowerCase())}</text>${text}</svg>`;
}

export function MagneticTargetPicker() {
  useEffect(() => {
    if (window.parent === window) return;
    const previewToken = new URLSearchParams(window.location.search).get("magneticPreview");
    if (!previewToken) return;

    const inspectOverlay = document.createElement("div");
    inspectOverlay.dataset.magneticTargetInspection = "true";
    Object.assign(inspectOverlay.style, {
      position: "fixed",
      zIndex: "2147483646",
      pointerEvents: "none",
      display: "none",
      border: "2px solid #79f2b1",
      borderRadius: "4px",
      background: "rgba(121, 242, 177, .08)",
      boxShadow: "0 0 0 99999px rgba(2, 8, 14, .12), 0 0 18px rgba(121, 242, 177, .7)",
    });
    const inspectLabel = document.createElement("span");
    Object.assign(inspectLabel.style, {
      position: "absolute",
      left: "0",
      top: "-25px",
      padding: "3px 7px",
      color: "#061117",
      background: "#79f2b1",
      borderRadius: "3px",
      font: "12px/1.4 sans-serif",
      whiteSpace: "nowrap",
      maxWidth: "280px",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });
    inspectOverlay.appendChild(inspectLabel);
    document.body.appendChild(inspectOverlay);

    let inspectedElement: Element | null = null;
    let inspectedTargetId = "";
    let layoutFrame = 0;
    const updateInspectOverlay = () => {
      layoutFrame = 0;
      if (!inspectedElement?.isConnected) {
        inspectOverlay.style.display = "none";
        return;
      }
      const rect = inspectedElement.getBoundingClientRect();
      inspectOverlay.style.display = rect.width > 0 && rect.height > 0 ? "block" : "none";
      inspectOverlay.style.left = `${rect.left}px`;
      inspectOverlay.style.top = `${rect.top}px`;
      inspectOverlay.style.width = `${Math.max(1, rect.width)}px`;
      inspectOverlay.style.height = `${Math.max(1, rect.height)}px`;
      inspectLabel.textContent = getTargetDisplayName(inspectedElement);
    };
    const scheduleInspectOverlay = () => {
      if (layoutFrame) return;
      layoutFrame = requestAnimationFrame(updateInspectOverlay);
    };
    const onInspect = (event: MessageEvent<{ type?: string; previewToken?: string; selector?: string; targetId?: string }>) => {
      const message = event.data;
      if (event.origin !== window.location.origin || event.source !== window.parent ||
          (message?.type !== "magnetic-target-inspect" && message?.type !== "magnetic-target-inspect-clear") ||
          message.previewToken !== previewToken) return;
      if (message.type === "magnetic-target-inspect-clear") {
        inspectedElement = null;
        inspectOverlay.style.display = "none";
        return;
      }
      inspectedTargetId = message.targetId ?? "";
      try {
        inspectedElement = message.selector ? document.querySelector(message.selector) : null;
      } catch {
        inspectedElement = null;
      }
      if (inspectedElement) inspectedElement.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      updateInspectOverlay();
      if (inspectedElement && inspectedTargetId) {
        window.parent.postMessage({
          type: "magnetic-target-preview",
          previewToken,
          targetId: inspectedTargetId,
          previewSvg: createElementPreviewSvg(inspectedElement),
        }, window.location.origin);
      }
    };
    window.addEventListener("message", onInspect);
    window.addEventListener("resize", scheduleInspectOverlay, { passive: true });
    window.addEventListener("scroll", scheduleInspectOverlay, { passive: true, capture: true });
    const layoutObserver = new ResizeObserver(scheduleInspectOverlay);
    layoutObserver.observe(document.documentElement);
    window.parent.postMessage({ type: "magnetic-target-inspection-ready", previewToken }, window.location.origin);
    const stopInspect = () => {
      window.removeEventListener("message", onInspect);
      window.removeEventListener("resize", scheduleInspectOverlay);
      window.removeEventListener("scroll", scheduleInspectOverlay, true);
      layoutObserver.disconnect();
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      inspectOverlay.remove();
    };

    const token = new URLSearchParams(window.location.search).get("magneticTargetPicker");
    if (!token) return stopInspect;

    const overlay = document.createElement("div");
    overlay.dataset.magneticTargetPicker = "true";
    Object.assign(overlay.style, {
      position: "fixed",
      zIndex: "2147483647",
      pointerEvents: "none",
      display: "none",
      border: "2px solid #65e8ff",
      borderRadius: "4px",
      background: "rgba(101, 232, 255, .12)",
      boxShadow: "0 0 0 99999px rgba(2, 8, 14, .2), 0 0 18px rgba(101, 232, 255, .7)",
    });
    const label = document.createElement("span");
    Object.assign(label.style, {
      position: "absolute",
      left: "0",
      top: "-25px",
      padding: "3px 7px",
      color: "#061117",
      background: "#65e8ff",
      borderRadius: "3px",
      font: "12px/1.4 sans-serif",
      whiteSpace: "nowrap",
      maxWidth: "280px",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });
    overlay.appendChild(label);
    document.body.appendChild(overlay);
    const previousCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = "crosshair";

    let active = true;
    const send = (message: TargetPickerMessage) => {
      window.parent.postMessage(message, window.location.origin);
    };
    const elementAtPointer = (event: PointerEvent): HTMLElement | SVGElement | null => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!isSelectableElement(target)) return null;
      const preferred = getPreferredTarget(target);
      return isSelectableElement(preferred) ? preferred : null;
    };
    const updateHighlight = (event: PointerEvent) => {
      const element = elementAtPointer(event);
      if (!element) {
        overlay.style.display = "none";
        return;
      }
      const rect = element.getBoundingClientRect();
      overlay.style.display = "block";
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${Math.max(1, rect.width)}px`;
      overlay.style.height = `${Math.max(1, rect.height)}px`;
      label.textContent = getTargetDisplayName(element);
    };
    const onPointerMove = (event: PointerEvent) => updateHighlight(event);
    const selectElement = (element: Element | null, event: Event) => {
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const target = getPreferredTarget(element);
      if (!isSelectableElement(target)) return;
      const selector = createUniqueElementSelector(target);
      if (!selector) {
        send({ type: "magnetic-target-pick-error", token, message: "That element could not be uniquely identified. Try selecting a nearby button, link, heading, or image." });
        return;
      }
      active = false;
      send({
        type: "magnetic-target-picked",
        token,
        selector,
        name: getTargetDisplayName(target),
        tagName: target.tagName.toLowerCase(),
        previewSvg: createElementPreviewSvg(target),
      });
      cleanup();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = elementAtPointer(event) ?? (event.target instanceof Element ? event.target : null);
      selectElement(target, event);
    };
    const onClick = (event: MouseEvent) => {
      if (!active) return;
      selectElement(event.target instanceof Element ? event.target : null, event);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      send({ type: "magnetic-target-pick-cancelled", token });
      cleanup();
    };
    const cleanup = () => {
      if (!active && !overlay.isConnected) return;
      active = false;
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.documentElement.style.cursor = previousCursor;
      overlay.remove();
    };
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cleanup();
      stopInspect();
    };
  }, []);

  return null;
}
