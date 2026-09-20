/* ============================================
   DOMINGO SERVICE — manage the Domingo homepage hero
   Isolated from the existing website:
     - hero data (name + image URL) is stored in
       domingo-data.json via /api/domingo
     - hero images are uploaded to Google Drive via
       the existing /api/gdrive
   Nothing here touches the existing published-data
   or reservations data used by the current site.
   ============================================ */

const DomingoService = (() => {
  const URL = window.location.origin + '/api/domingo';
  const GDRIVE_URL = window.location.origin + '/api/gdrive';
  const FOLDER = 'DomingoHero';

  async function get() {
    const res = await fetch(URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { name: '', image: '', ...((data && data.hero) || {}) };
  }

  async function save(hero) {
    const res = await fetch(URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ hero }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Publish failed (HTTP ' + res.status + ')');
    }
    return true;
  }

  // Upload a hero image to Google Drive and return its public URL + fileId.
  async function uploadImage(file) {
    const compressed = await ImageService.upload(file, { maxDim: 1400, quality: 0.8 });
    const res = await fetch(GDRIVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: compressed.url, mimeType: 'image/jpeg', folder: FOLDER }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.publicImageUrl) throw new Error(data.error || 'Image upload failed. Please try again.');
    return { url: data.publicImageUrl, fileId: data.fileId || '' };
  }

  return { get, save, uploadImage };
})();