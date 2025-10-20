const code = `
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if ((window).__preloadAsFixInitialized) {
    return;
  }
  (window).__preloadAsFixInitialized = true;

  function inferAsFromHref(href) {
    if (!href) return null;
    try {
      var url = new URL(href, window.location.origin);
      var path = url.pathname.toLowerCase();
      if (path.endsWith('.js') || path.endsWith('.mjs')) return 'script';
      if (path.endsWith('.css')) return 'style';
      if (path.endsWith('.woff2') || path.endsWith('.woff') || path.endsWith('.ttf') || path.endsWith('.otf')) return 'font';
      if (
        path.endsWith('.png') ||
        path.endsWith('.jpg') ||
        path.endsWith('.jpeg') ||
        path.endsWith('.gif') ||
        path.endsWith('.webp') ||
        path.endsWith('.svg') ||
        path.endsWith('.ico') ||
        path.endsWith('.bmp') ||
        path.endsWith('.avif')
      )
        return 'image';
      if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.ogg')) return 'video';
      if (path.endsWith('.mp3') || path.endsWith('.wav') || path.endsWith('.flac')) return 'audio';
      if (path.endsWith('.pdf')) return 'document';
    } catch (e) {
      return null;
    }
    return null;
  }

  function applyAsAttribute(link) {
    if (!link || link.rel !== 'preload') return;
    var current = link.getAttribute('as');
    if (current && current.trim().length > 0) return;

    var inferred = inferAsFromHref(link.getAttribute('href') || '');
    if (inferred) {
      link.setAttribute('as', inferred);
    }
  }

  function applyToNode(node) {
    if (!node) return;
    if (node.nodeType === 1 && node.tagName === 'LINK') {
      applyAsAttribute(node);
      return;
    }
    if (node.nodeType === 1) {
      var links = node.querySelectorAll('link[rel="preload"]');
      for (var i = 0; i < links.length; i++) {
        applyAsAttribute(links[i]);
      }
    }
  }

  var initialLinks = document.querySelectorAll('link[rel="preload"]');
  for (var i = 0; i < initialLinks.length; i++) {
    applyAsAttribute(initialLinks[i]);
  }

  if (typeof MutationObserver === 'undefined') {
    return;
  }

  var target = document.head || document.documentElement;
  if (!target) {
    return;
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type === 'attributes' && mutation.target && mutation.target.tagName === 'LINK') {
        applyAsAttribute(mutation.target);
      }
      if (mutation.type === 'childList' && mutation.addedNodes) {
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          applyToNode(mutation.addedNodes[j]);
        }
      }
    }
  });

  observer.observe(target, {
    attributes: true,
    attributeFilter: ['rel', 'href', 'as'],
    childList: true,
    subtree: true,
  });

  var disconnect = function () {
    observer.disconnect();
    window.removeEventListener('beforeunload', disconnect);
    window.removeEventListener('pagehide', disconnect);
  };

  window.addEventListener('beforeunload', disconnect);
  window.addEventListener('pagehide', disconnect);
})();
`;

declare global {
  interface Window {
    __preloadAsFixInitialized?: boolean;
  }
}

export default function PreloadAsFix() {
  return <script dangerouslySetInnerHTML={{ __html: code }} suppressHydrationWarning />;
}
