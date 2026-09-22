(() => {
  // Constants

  const EMBED_MESSAGE_SOURCE = 'trustcontract';
  const STORAGE_KEY = 'iframe-signing-harness:v1';


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

  function appendLog(entry) {
    const stamp = new Date().toISOString();
    const block = `[${stamp}]\n${JSON.stringify(entry, null, 2)}\n\n`;

    els.log.textContent = block + els.log.textContent;
  }

  function setLastEvent(type) {
    els.lastEvent.textContent = type || 'none';
    els.lastEvent.dataset.type = type || '';
  }

  function loadIframe() {
    const baseUrl = getBaseUrl();
    const shortUrl = getShortUrl();
    const src = buildIframeSrc(baseUrl, shortUrl);

    saveState();
    syncCustomBaseVisibility();

    if (!src) {
      els.iframeSrc.textContent = '—';
      appendLog({ level: 'harness', message: 'Set Base URL and Short URL, then press Load' });
      return;
    }

    els.iframeSrc.textContent = src;
    els.signingFrame.src = src;
    setLastEvent('loading');
    appendLog({ level: 'harness', message: 'iframe loaded', src });
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
    appendLog({
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
    appendLog({ level: 'harness', message: 'iframe reloaded' });
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
    level: 'harness',
    message: 'Ready. Enter shortUrl and press Load.',
    protocol: {
      source: EMBED_MESSAGE_SOURCE,
      types: ['ready', 'status', 'signed', 'error', 'revoked'],
      path: '/contract/uploader/:shortUrl',
    },
  });
})();
