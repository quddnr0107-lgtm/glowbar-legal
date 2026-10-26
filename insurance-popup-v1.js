(function () {
  'use strict';

  function start() {
    var inline = document.querySelector('[data-insurance-consultation]');
    if (!inline || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    if (/(?:^|\/)(?:privacy|terms|policy|admin|login|signin|auth|account|payment|checkout|billing)(?:[/.\-]|$)/i.test(location.pathname)) return;
    var source = inline.querySelector('img');
    var sourceLink = inline.querySelector('a');
    if (!source || !sourceLink || document.getElementById('insurance-consultation-popup')) return;

    var scope = inline.getAttribute('data-insurance-scope') || location.hostname;
    var prefix = 'insurance-consultation:' + scope + ':';
    var seenKey = prefix + 'session';
    var dayKey = prefix + 'hidden-day';
    function todayKst() {
      return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
    function suppressed() {
      try {
        return sessionStorage.getItem(seenKey) === '1' || localStorage.getItem(dayKey) === todayKst();
      } catch (_) {
        return true;
      }
    }
    // If persistence is unavailable, keep the inline ad and avoid repeated popups.
    try {
      var probe = prefix + 'probe';
      sessionStorage.setItem(probe, '1');
      sessionStorage.removeItem(probe);
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
    } catch (_) { return; }
    if (suppressed()) return;

    var dialog = document.createElement('dialog');
    dialog.id = 'insurance-consultation-popup';
    dialog.setAttribute('aria-label', '보험 상담 광고');
    dialog.setAttribute('lang', 'ko');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('data-insurance-popup', '');

    var link = document.createElement('a');
    link.href = sourceLink.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer sponsored';
    link.className = 'insurance-popup-image-link';
    var image = document.createElement('img');
    image.src = source.src;
    image.alt = source.alt;
    image.width = 1536;
    image.height = 1024;
    image.decoding = 'async';
    link.appendChild(image);
    dialog.appendChild(link);

    var controls = document.createElement('div');
    controls.className = 'insurance-popup-controls';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '닫기';
    close.setAttribute('autofocus', '');
    var hideToday = document.createElement('button');
    hideToday.type = 'button';
    hideToday.textContent = '오늘 하루 보지 않기';
    controls.appendChild(close);
    controls.appendChild(hideToday);
    dialog.appendChild(controls);

    var style = document.createElement('style');
    style.textContent = '#insurance-consultation-popup{box-sizing:border-box;width:min(720px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);margin:auto;padding:0;overflow:auto;border:1px solid #d2e4d7;border-radius:16px;background:#fffdf5;color:#203b2d;box-shadow:0 16px 64px #0005}#insurance-consultation-popup::backdrop{background:#0009}#insurance-consultation-popup .insurance-popup-image-link{display:block;line-height:0;outline-offset:-4px}#insurance-consultation-popup img{display:block;width:100%;height:auto;max-height:calc(100vh - 100px);max-height:calc(100dvh - 100px);object-fit:contain;border:0}#insurance-consultation-popup .insurance-popup-controls{display:grid;grid-template-columns:auto 1fr;gap:8px;padding:12px}#insurance-consultation-popup button{box-sizing:border-box;min-height:44px;margin:0;padding:8px 14px;border:1px solid #758b7c;border-radius:8px;background:#fff;color:#203b2d;font:600 14px/1.4 system-ui,sans-serif;cursor:pointer}#insurance-consultation-popup button:focus-visible,#insurance-consultation-popup a:focus-visible{outline:3px solid #176b42;outline-offset:-3px}';
    document.head.appendChild(style);
    document.body.appendChild(dialog);

    var previousFocus = null;
    var modalObserver = null;
    function dismiss() {
      if (dialog.open) dialog.close();
    }
    close.addEventListener('click', dismiss);
    hideToday.addEventListener('click', function () {
      try { localStorage.setItem(dayKey, todayKst()); } catch (_) { /* Session suppression remains active. */ }
      dismiss();
    });
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      dismiss();
    });
    dialog.addEventListener('keydown', function (event) {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      var focusable = [link, close, hideToday];
      var index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        hideToday.focus();
      } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
        event.preventDefault();
        link.focus();
      }
    });
    ['keyup', 'keypress'].forEach(function (name) {
      dialog.addEventListener(name, function (event) { event.stopPropagation(); });
    });
    dialog.addEventListener('close', function () {
      if (modalObserver) modalObserver.disconnect();
      if (!otherModalVisible() && previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      }
    });
    function otherModalVisible() {
      return Array.prototype.some.call(document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"], .modal, .modal-overlay, .overlay'), function (element) {
        if (element === dialog || dialog.contains(element)) return false;
        if (element.getAttribute('aria-hidden') === 'true' || element.hidden) return false;
        var css = getComputedStyle(element);
        var rect = element.getBoundingClientRect();
        return element.getClientRects().length > 0 && css.display !== 'none' && css.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
      });
    }
    function tryShow() {
      if (suppressed()) return;
      var focused = document.activeElement;
      if (document.hidden || otherModalVisible() || (focused && focused.matches('input, textarea, select, [contenteditable="true"]'))) {
        window.setTimeout(tryShow, 1000);
        return;
      }
      // Reserve the session before opening, so storage failure cannot cause repeats.
      try { sessionStorage.setItem(seenKey, '1'); } catch (_) { return; }
      previousFocus = focused;
      try { dialog.showModal(); close.focus({ preventScroll: true }); } catch (_) { return; }
      if (typeof MutationObserver !== 'undefined') {
        modalObserver = new MutationObserver(function () {
          if (dialog.open && otherModalVisible()) dismiss();
        });
        modalObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'class', 'style', 'hidden', 'aria-hidden', 'aria-modal'] });
      }
    }
    window.setTimeout(tryShow, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
