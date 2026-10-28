/* DigitaHinos Coral – instalação como app (PWA)
 * Captura o evento de instalação do navegador o quanto antes e o compartilha com a tela inicial e o compositor. */
(function (global) {
  'use strict';
  const CC = (global.CC = global.CC || {});
  let deferred = null;
  const listeners = [];
  const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
  const native = () => !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
  const standalone = () => native()
    || (global.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches))
    || global.navigator.standalone === true;
  const ua = global.navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && global.navigator.maxTouchPoints > 1);

  global.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  global.addEventListener('appinstalled', () => { deferred = null; emit(); });

  CC.install = {
    onChange(fn) { listeners.push(fn); },
    canPrompt: () => !!deferred && !standalone(),
    isStandalone: standalone,
    isNative: native,
    isIOS: iOS,
    async prompt() {
      if (!deferred) return 'unavailable';
      deferred.prompt();
      let r = 'dismissed';
      try { r = (await deferred.userChoice).outcome; } catch (e) { /* ignore */ }
      deferred = null; emit();
      return r;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
