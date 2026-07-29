/* ============================================
   IMAGE UPLOAD — Modular cloud storage provider

   Swappable: change uploadImage() internals
   to use Supabase, Firebase, S3, etc.
   ============================================ */

const ImageUpload = (() => {

  /* ---------- Config (set via localStorage or window) ---------- */
  function getConfig() {
    // Try window vars first (set by loadBusiness), then localStorage
    let cloudName = window.CLOUDINARY_CLOUD_NAME || '';
    let uploadPreset = window.CLOUDINARY_UPLOAD_PRESET || '';
    if (!cloudName || !uploadPreset) {
      try {
        const biz = JSON.parse(localStorage.getItem('ss_business') || '{}');
        cloudName = cloudName || biz.cloudName || '';
        uploadPreset = uploadPreset || biz.cloudUploadPreset || '';
      } catch {}
    }
    return {
      cloudName,
      uploadPreset,
      endpoint: window.CLOUDINARY_ENDPOINT || 'https://api.cloudinary.com/v1_1',
    };
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
            (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
            'image/jpeg',
            quality
          );
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Upload to Cloudinary ---------- */
  async function uploadToCloudinary(blob) {
    const cfg = getConfig();
    if (!cfg.cloudName || !cfg.uploadPreset) {
      throw new Error('Cloud storage not configured. Set Cloudinary credentials in admin settings.');
    }
    const form = new FormData();
    form.append('file', blob);
    form.append('upload_preset', cfg.uploadPreset);
    form.append('folder', 'sweetsundays');

    const url = `${cfg.endpoint}/${cfg.cloudName}/image/upload`;
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Upload failed');
    }
    return res.json();
  }

  /* ---------- Public: upload image ---------- */
  async function upload(file) {
    validate(file);
    const blob = await compress(file);
    const data = await uploadToCloudinary(blob);
    return {
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
    };
  }

  /* ---------- Public: check if base64 (needs migration) ---------- */
  function isBase64(str) {
    return typeof str === 'string' && str.startsWith('data:image');
  }

  /* ---------- Public: migrate a single base64 image ---------- */
  async function migrateBase64(dataUrl) {
    const blob = await (async () => {
      const res = await fetch(dataUrl);
      return res.blob();
    })();
    const file = new File([blob], 'migrated.jpg', { type: blob.type || 'image/jpeg' });
    return upload(file);
  }

  return { upload, validate, isBase64, migrateBase64, getConfig };
})();
