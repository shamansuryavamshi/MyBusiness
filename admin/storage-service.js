/* ============================================
   STORAGE SERVICE — Backend-backed source of truth
   All published content (Dessert, Location, Business,
   Website, Gallery, Reviews, Announcements, History)
   lives here and syncs to /api/data.

   localStorage is used ONLY for auth (ss_auth) and
   dark mode (ss_darkMode) — see DB in config.js.
   ============================================ */

const StorageService = (() => {
  const KEY_MAP = {
    [STORAGE_KEYS.BUSINESS]: 'business',
    [STORAGE_KEYS.DESSERT]: 'weeklyDessert',
    [STORAGE_KEYS.DESSERT_HISTORY]: 'dessertHistory',
    [STORAGE_KEYS.LOCATION]: 'location',
    [STORAGE_KEYS.GALLERY]: 'gallery',
    [STORAGE_KEYS.REVIEWS]: 'reviews',
    [STORAGE_KEYS.ANNOUNCEMENTS]: 'announcements',
    [STORAGE_KEYS.WEBSITE]: 'website',
  };

  const DEFAULTS = {
    weeklyDessert: DEFAULT_DESSERT,
    location: DEFAULT_LOCATION,
    business: DEFAULT_BUSINESS,
    website: DEFAULT_WEBSITE,
    gallery: DEFAULT_GALLERY,
    reviews: DEFAULT_REVIEWS,
    announcements: DEFAULT_ANNOUNCEMENTS,
    dessertHistory: DEFAULT_DESSERT_HISTORY,
  };

  const clone = (v) => JSON.parse(JSON.stringify(v));

  function buildDefaults() {
    const s = {};
    Object.keys(DEFAULTS).forEach((k) => { s[k] = clone(DEFAULTS[k]); });
    return s;
  }

  let state = buildDefaults();
  let readyPromise = null;

  function mergeKey(name, remote) {
    const def = DEFAULTS[name];
    if (remote == null) return clone(def);
    if (Array.isArray(def)) return Array.isArray(remote) ? remote : clone(def);
    if (def !== null && typeof def === 'object') {
      return Object.assign({}, clone(def), remote);
    }
    return remote;
  }

  function applyRemote(remote) {
    if (!remote || typeof remote !== 'object') return;
    Object.keys(DEFAULTS).forEach((name) => {
      if (remote[name] != null) state[name] = mergeKey(name, remote[name]);
    });
  }

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      try {
        const remote = await ApiService.get();
        if (remote && !remote.error && remote.publishedAt) applyRemote(remote);
      } catch (e) {
        console.warn('Storage init failed, using defaults:', e.message);
      }
    })();
    return readyPromise;
  }

  function payloadName(key) { return KEY_MAP[key]; }

  function get(key, fallback) {
    const name = KEY_MAP[key];
    if (name) {
      if (state[name] != null) return state[name];
      return fallback != null ? fallback : DEFAULTS[name];
    }
    return null;
  }

  function set(key, value) {
    const name = KEY_MAP[key];
    if (!name) return false;
    state[name] = value;
    scheduleSave();
    return true;
  }

  function buildPayload() {
    return {
      weeklyDessert: state.weeklyDessert,
      location: state.location,
      business: state.business,
      website: state.website,
      gallery: state.gallery,
      reviews: state.reviews,
      announcements: state.announcements,
      dessertHistory: state.dessertHistory,
      publishedAt: new Date().toISOString(),
    };
  }

  /* Debounced + serialized persistence.
     Vercel rejects request bodies over ~4.5MB with HTTP 413, so we guard
     the payload size and retry transient failures. Background-save errors
     are surfaced through onError so the admin knows their change did not
     sync to other devices. */
  const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
  let saveTimer = null;
  let onError = null;

  function payloadBytes(payload) {
    const s = JSON.stringify(payload);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
    return unescape(encodeURIComponent(s)).length;
  }

  function persist() {
    const payload = buildPayload();
    const bytes = payloadBytes(payload);
    if (bytes > MAX_PAYLOAD_BYTES) {
      const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
      throw new Error(`Published data is too large (${mb} MB). Remove some gallery images or upload smaller photos.`);
    }
    const run = async () => {
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await ApiService.enqueue(payload);
        } catch (e) {
          lastErr = e;
          if (String(e.message).includes('413')) {
            throw new Error('Published data is too large for the server. Remove some gallery images or upload smaller photos.');
          }
          if (attempt < 2) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        }
      }
      throw lastErr;
    };
    return run();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist().catch((e) => {
        console.warn('Background save failed:', e.message);
        if (onError) onError('Sync failed: ' + e.message);
      });
    }, 600);
  }

  async function save() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    return persist();
  }

  return {
    init,
    get,
    set,
    save,
    payloadName,
    setErrorHandler(fn) { onError = fn; },
    getAll() { return state; },
  };
})();
