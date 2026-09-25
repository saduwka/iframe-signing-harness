(() => {
  // Constants

  const EMBED_MESSAGE_SOURCE = 'trustcontract';
  const STORAGE_KEY = 'iframe-signing-harness:v1';
  const MAX_LOG_CHARS = 200000;


  // Getting the data

  const els = {
    basePreset: document.getElementById('basePreset'),
    customBaseWrap: document.getElementById('customBaseWrap'),
    customBase: document.getElementById('customBase'),
    shortUrl: document.getElementById('shortUrl'),
    loadBtn: document.getElementById('loadBtn'),
    reloadBtn: document.getElementById('reloadBtn'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    iframeSrc: document.getElementById('iframeSrc'),
    lastEvent: document.getElementById('lastEvent'),
    signingFrame: document.getElementById('signingFrame'),
    log: document.getElementById('log'),
  };

  const nativeConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };


  // Defining the functions

  function getBaseUrl() {
    if (els.basePreset.value === 'custom')
      return String(els.customBase.value || '').trim().replace(/\/$/, '');

    return els.basePreset.value;
  }

  function getExpectedOrigin(baseUrl) {
    try {
      return new URL(baseUrl).origin;
    } catch (e) {
      return null;
    }
  }

  function getShortUrl() {
    return String(els.shortUrl.value || '').trim().replace(/^\/+|\/+$/g, '');
  }

  /**
   * Собирает URL партнёрского embed.
   * Почему /uploader/: shortUrl — только route Uploads шлёт trustcontract postMessage.
   */
  function buildIframeSrc(baseUrl, shortUrl) {
    if (!baseUrl || !shortUrl) return null;

    return `${baseUrl}/contract/uploader/${encodeURIComponent(shortUrl)}`;
  }

  function saveState() {
    const state = {
      basePreset: els.basePreset.value,
      customBase: els.customBase.value,
      shortUrl: els.shortUrl.value,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore quota / private mode
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) return;

      const state = JSON.parse(raw);

      if (state.basePreset) els.basePreset.value = state.basePreset;
      if (state.customBase) els.customBase.value = state.customBase;
      if (state.shortUrl) els.shortUrl.value = state.shortUrl;
    } catch (e) {
      // ignore broken storage
    }
  }

  function syncCustomBaseVisibility() {
    els.customBaseWrap.hidden = els.basePreset.value !== 'custom';
  }

  function getChannelPrefix(entry) {
    const channel = entry?.channel || 'harness';

    if (channel === 'postMessage')
      return `[postMessage:${entry.type || 'unknown'}]`;

    if (channel === 'console')
      return `[console:${entry.level || 'log'}]`;

    if (channel === 'network')
      return `[network]`;

    return `[harness]`;
  }

  function appendLog(entry) {
    const stamp = new Date().toISOString();
    const prefix = getChannelPrefix(entry);
    const block = `${prefix} ${stamp}\n${JSON.stringify(entry, null, 2)}\n\n`;

    els.log.textContent = (block + els.log.textContent).slice(0, MAX_LOG_CHARS);
  }

  function setLastEvent(type) {
    els.lastEvent.textContent = type || 'none';
    els.lastEvent.dataset.type = type || '';
  }

  function safeSerializeArg(arg) {
    if (arg instanceof Error)
      return { name: arg.name, message: arg.message, stack: arg.stack };

    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean' || arg == null)
      return arg;

    try {
      return JSON.parse(JSON.stringify(arg));
    } catch (e) {
      return String(arg);
    }
  }

  function installParentConsoleBridge() {
    ['log', 'info', 'warn', 'error'].forEach((level) => {
      console[level] = (...args) => {
        nativeConsole[level](...args);

        // Avoid recursive noise from our own appendLog path
        try {
          appendLog({
            channel: 'console',
            level,
            args: args.map(safeSerializeArg),
            scope: 'parent',
          });
        } catch (e) {
          nativeConsole.error('harness: console bridge failed', e);
        }
      };
    });
  }

  function installParentNetworkObserver() {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType !== 'resource') return;

          const failed = entry.transferSize === 0 && entry.decodedBodySize === 0 && entry.duration < 10;

          appendLog({
            channel: 'network',
            scope: 'parent',
            name: entry.name,
            initiatorType: entry.initiatorType,
            duration: Math.round(entry.duration),
            transferSize: entry.transferSize,
            failed: Boolean(failed),
          });
        });
      });

      observer.observe({ type: 'resource', buffered: true });
    } catch (e) {
      nativeConsole.warn('harness: PerformanceObserver unavailable', e);
    }
  }

  function loadIframe() {
    const baseUrl = getBaseUrl();
    const shortUrl = getShortUrl();
    const src = buildIframeSrc(baseUrl, shortUrl);

    saveState();
    syncCustomBaseVisibility();

    if (!src) {
      els.iframeSrc.textContent = '—';
      appendLog({ channel: 'harness', message: 'Set Base URL and Short URL, then press Load' });
      return;
    }

    els.iframeSrc.textContent = src;
    els.signingFrame.src = src;
    setLastEvent('loading');
    appendLog({ channel: 'harness', message: 'iframe loaded', src });
  }

  function onMessage(event) {
    const expectedOrigin = getExpectedOrigin(getBaseUrl());
    const data = event.data;


    // Doing some checks

    if (!expectedOrigin || event.origin !== expectedOrigin) return;

    if (!data || typeof data !== 'object') return;

    if (data.source !== EMBED_MESSAGE_SOURCE) return;


    // Getting the result

    setLastEvent(data.type || 'unknown');

    if (data.type === 'debug') {
      const kind = data.payload?.kind;

      appendLog({
        channel: kind === 'network' ? 'network' : 'console',
        scope: 'iframe',
        origin: event.origin,
        source: data.source,
        version: data.version,
        type: data.type,
        payload: data.payload,
        timestamp: data.timestamp,
      });
      return;
    }

    appendLog({
      channel: 'postMessage',
      origin: event.origin,
      source: data.source,
      version: data.version,
      type: data.type,
      payload: data.payload,
      timestamp: data.timestamp,
    });
  }


  // Getting the result

  loadState();
  syncCustomBaseVisibility();
  installParentConsoleBridge();
  installParentNetworkObserver();

  els.basePreset.addEventListener('change', () => {
    syncCustomBaseVisibility();
    saveState();
  });

  els.customBase.addEventListener('change', saveState);
  els.shortUrl.addEventListener('change', saveState);

  els.loadBtn.addEventListener('click', loadIframe);
  els.reloadBtn.addEventListener('click', () => {
    if (!els.signingFrame.src) {
      loadIframe();
      return;
    }

    els.signingFrame.src = els.signingFrame.src;
    setLastEvent('reloading');
    appendLog({ channel: 'harness', message: 'iframe reloaded' });
  });

  els.clearLogBtn.addEventListener('click', () => {
    els.log.textContent = '';
    setLastEvent('none');
  });

  els.shortUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadIframe();
  });

  window.addEventListener('message', onMessage);

  appendLog({
    channel: 'harness',
    message: 'Ready. Enter shortUrl and press Load. Debug log shows parent console/network + trustcontract postMessage (incl. type debug from iframe).',
    protocol: {
      source: EMBED_MESSAGE_SOURCE,
      types: ['ready', 'status', 'signed', 'error', 'revoked', 'debug'],
      path: '/contract/uploader/:shortUrl',
    },
  });
})();
