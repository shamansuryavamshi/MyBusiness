/* ============================================
   API SERVICE — Low-level transport for published data
   GET  /api/data  -> current published JSON
   PUT  /api/data  -> overwrite published JSON (GitHub Contents API)
   All writes are serialized so concurrent PUTs never race on the
   GitHub file sha.
   ============================================ */

const ApiService = (() => {
  const URL = window.location.origin + '/api/data';

  let writeQueue = Promise.resolve();

  async function get() {
    const res = await fetch(URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function set(data) {
    const json = JSON.stringify(data);
    const res = await fetch(URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: json,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Publish failed (HTTP ' + res.status + ')');
    }
    return true;
  }

  // Serialize writes so the GitHub file sha never goes stale mid-flight.
  // A failed write surfaces to the caller but never poisons the queue.
  function enqueue(data) {
    const run = writeQueue.then(() => set(data));
    writeQueue = run.catch(() => {});
    return run;
  }

  return { get, set, enqueue };
})();
