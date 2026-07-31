/* ============================================
   IMAGE UPLOAD — Backward-compatible wrapper
   All logic now lives in ImageService.
   Kept as ImageUpload for existing call sites.
   ============================================ */

const ImageUpload = (() => {
  return {
    upload(file) { return ImageService.upload(file); },
    remove(fileId) { return ImageService.remove(fileId); },
    validate(file) { return ImageService.validate(file); },
    isBase64(str) { return ImageService.isBase64(str); },
  };
})();
