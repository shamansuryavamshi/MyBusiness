/* ============================================
   DOMINGO SERVICE — DOMINGO-only CMS client
   Isolated from the existing website:
     - hero data (name + image) is stored in
       domingo-data.json via /api/domingo
     - hero images are compressed in-browser via
       ImageService (the existing working image
       mechanism) and saved inline with the hero.
   Nothing here touches published-data.json,
   reservations, or any other old website data.
   All reads/writes are no-cache.
   ============================================ */

const DomingoService = (() => {
  const URL = window.location.origin + '/api/domingo';

  async function get() {
    const res = await fetch(URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { name: '', image: '', updatedAt: null, ...((data && data.hero) || {}) };
  }

  async function save(hero) {
    const res = await fetch(URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ hero }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Publish failed (HTTP ' + res.status + ')');
    }
    if (!data || !data.hero) {
      throw new Error('Server did not return the saved hero.');
    }
    return { success: true, hero: data.hero };
  }

  // Existing working image mechanism: ImageService compresses in-browser
  // and returns a base64 data URL that gets stored inline with the hero.
  async function uploadImage(file) {
    const result = await ImageService.upload(file, { maxDim: 1400, quality: 0.8 });
    return { url: result.url, fileId: result.fileId || '' };
  }

  return { get, save, uploadImage };
})();