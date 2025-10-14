"use client";

import { useEffect } from "react";

type PreloadType =
  | "audio"
  | "document"
  | "fetch"
  | "font"
  | "image"
  | "script"
  | "style"
  | "track"
  | "video";

function inferAsFromHref(href: string): PreloadType | null {
  if (!href) return null;
  try {
    const url = new URL(href, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    const path = url.pathname.toLowerCase();
    if (path.endsWith(".js") || path.endsWith(".mjs")) return "script";
    if (path.endsWith(".css")) return "style";
    if (path.endsWith(".woff2") || path.endsWith(".woff") || path.endsWith(".ttf") || path.endsWith(".otf")) return "font";
    if (
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".gif") ||
      path.endsWith(".webp") ||
      path.endsWith(".svg") ||
      path.endsWith(".ico") ||
      path.endsWith(".bmp") ||
      path.endsWith(".avif")
    )
      return "image";
    if (path.endsWith(".mp4") || path.endsWith(".webm") || path.endsWith(".ogg")) return "video";
    if (path.endsWith(".mp3") || path.endsWith(".wav") || path.endsWith(".flac")) return "audio";
    if (path.endsWith(".pdf")) return "document";
  } catch {
    // ignore invalid URLs
  }
  return null;
}

function applyAsAttribute(link: HTMLLinkElement) {
  if (link.rel !== "preload") return;
  const current = link.getAttribute("as");
  if (current && current.trim().length > 0) return;

  const inferred = inferAsFromHref(link.getAttribute("href") ?? "");
  link.setAttribute("as", inferred ?? "fetch");
}

function applyToNode(node: Node) {
  if (node instanceof HTMLLinkElement) {
    applyAsAttribute(node);
    return;
  }
  if (node instanceof Element) {
    node.querySelectorAll('link[rel="preload"]').forEach(el => applyAsAttribute(el as HTMLLinkElement));
  }
}

export default function PreloadAsFix() {
  useEffect(() => {
    document.querySelectorAll('link[rel="preload"]').forEach(link => applyAsAttribute(link as HTMLLinkElement));

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLLinkElement) {
          applyAsAttribute(mutation.target);
        }
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(applyToNode);
        }
      }
    });

    observer.observe(document.head, {
      attributes: true,
      attributeFilter: ["rel", "href", "as"],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
