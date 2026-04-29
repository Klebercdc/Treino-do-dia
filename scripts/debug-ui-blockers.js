(function () {
  function listBlockers() {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var blockers = [];

    document.querySelectorAll('body *').forEach(function (el) {
      var style = getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      var zIndex = Number.parseInt(style.zIndex, 10) || 0;
      var coversScreen =
        rect.width >= viewportWidth * 0.75 &&
        rect.height >= viewportHeight * 0.55;
      var suspicious =
        style.position === 'fixed' &&
        zIndex >= 900 &&
        coversScreen &&
        style.pointerEvents !== 'none';
      var invisible =
        style.opacity === '0' ||
        style.visibility === 'hidden';

      if (suspicious || (suspicious && invisible)) {
        blockers.push({
          id: el.id || null,
          className: String(el.className || ''),
          tagName: el.tagName,
          position: style.position,
          zIndex: zIndex,
          pointerEvents: style.pointerEvents,
          opacity: style.opacity,
          visibility: style.visibility,
          display: style.display,
          rect: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        });
      }
    });

    console.table(blockers);
    return blockers;
  }

  function unblockNow() {
    if (window.KroniaUI && typeof window.KroniaUI.unblockScreens === 'function') {
      window.KroniaUI.unblockScreens('debug-ui-blockers');
    }
    return listBlockers();
  }

  window.KroniaDebug = Object.assign({}, window.KroniaDebug || {}, {
    listBlockers: listBlockers,
    unblockNow: unblockNow
  });
})();
