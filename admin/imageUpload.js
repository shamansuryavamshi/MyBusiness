/* ============================================
   IMAGE UPLOAD — Modular storage provider

   Swappable: change the base URL to use a
   different backend (Supabase, Firebase, etc.)
   ============================================ */

const ImageUpload = (() => {

  /* ---------- API base URL ---------- */
  function getApiBase() {
    return window.API_BASE_URL || '/api/gdrive';
  }

  /* ---------- Validation ---------- */
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024;

  function validate(file) {
    if (!file) throw new Error('No file provided');
    if (!ALLOWED.includes(file.type)) throw new Error('Only JPG, PNG, and WEBP images are allowed');
    if (file.size > MAX_SIZE) throw new Error('Image must be under 5MB');
  }

  /* ---------- Client-side compression ---------- */
  function compress(file, maxDim = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => resolve(blob),
            'image/jpeg',
            quality
          );
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Upload to backend ---------- */
  async function uploadToBackend(base64, mimeType, folder) {
    const url = getApiBase();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ image: base64, mimeType, folder }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Image upload failed');
    }
    return res.json();
  }

  /* ---------- Public: upload image ---------- */
  async function upload(file, folder) {
    validate(file);
    const blob = await compress(file);
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Failed to read file'));
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
    const data = await uploadToBackend(base64, file.type || 'image/jpeg', folder || 'FeaturedDesserts');
    return {
      url: data.publicImageUrl || data.url,
      fileId: data.fileId,
    };
  }

  /* ---------- Delete from backend ---------- */
  async function remove(fileId) {
    if (!fileId) return;
    const url = getApiBase() + '?id=' + encodeURIComponent(fileId);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Failed to delete from Google Drive:', err.error);
    }
  }

  /* ---------- Public: check if base64 (needs migration) ---------- */
  function isBase64(str) {
    return typeof str === 'string' && str.startsWith('data:image');
  }

  /* ---------- Public: migrate a single base64 image ---------- */
  async function migrateBase64(dataUrl, folder) {
    const blob = await (async () => {
      const res = await fetch(dataUrl);
      return res.blob();
    })();
    const file = new File([blob], 'migrated.jpg', { type: blob.type || 'image/jpeg' });
    return upload(file, folder);
  }

  return { upload, remove, validate, isBase64, migrateBase64 };
})();
