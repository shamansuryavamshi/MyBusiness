/* ============================================
   IMAGE SERVICE — validate / compress / encode
   Images are compressed in-browser and stored as
   base64 data URLs inside the published data, so
   they render on every device with no backend.
   ============================================ */

const ImageService = (() => {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024;

  function validate(file) {
    if (!file) throw new Error('No file provided');
    if (!ALLOWED.includes(file.type)) throw new Error('Only JPG, PNG, and WEBP images are allowed');
    if (file.size > MAX_SIZE) throw new Error('Image must be under 5MB');
  }

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
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Failed to read file'));
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }

  async function upload(file) {
    validate(file);
    const blob = await compress(file);
    const url = await blobToDataURL(blob);
    return { url, fileId: null, publicImageUrl: url };
  }

  async function remove() {
    // Images live inline in the published data — nothing external to delete.
  }

  function isBase64(str) {
    return typeof str === 'string' && str.startsWith('data:image');
  }

  return { validate, compress, upload, remove, isBase64 };
})();
