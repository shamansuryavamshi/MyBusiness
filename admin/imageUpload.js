const ImageUpload = (() => {

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

  async function upload(file, folder) {
    validate(file);
    const blob = await compress(file);
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Failed to read file'));
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
    return { url: base64, fileId: null, publicImageUrl: base64 };
  }

  async function remove(fileId) {
  }

  function isBase64(str) {
    return typeof str === 'string' && str.startsWith('data:image');
  }

  return { upload, remove, validate, isBase64 };
})();
    const file = new File([blob], 'migrated.jpg', { type: blob.type || 'image/jpeg' });
    return upload(file, folder);
  }

  return { upload, remove, validate, isBase64, migrateBase64 };
})();
