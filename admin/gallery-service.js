/* ============================================
   GALLERY SERVICE — upload / render / delete
   Persisted to the shared backend via StorageService,
   so gallery changes appear on every device.
   ============================================ */

const GalleryService = (() => {
  function all() {
    return StorageService.get(STORAGE_KEYS.GALLERY, []) || [];
  }

  function find(id) {
    return all().find((g) => String(g.id) === String(id));
  }

  async function add(file) {
    const result = await ImageService.upload(file);
    const gallery = all();
    const item = {
      id: uid(),
      url: result.url,
      fileId: result.fileId,
      caption: file.name,
      category: 'desserts',
      order: gallery.length + 1,
    };
    gallery.push(item);
    StorageService.set(STORAGE_KEYS.GALLERY, gallery);
    return item;
  }

  async function remove(id) {
    const item = find(id);
    if (item && item.fileId) {
      try { await ImageService.remove(item.fileId); } catch (e) { console.warn('Failed to delete image:', e); }
    }
    const gallery = all().filter((g) => String(g.id) !== String(id));
    StorageService.set(STORAGE_KEYS.GALLERY, gallery);
    return gallery;
  }

  function renderHTML(item) {
    return `
      <div class="gallery-item" data-id="${item.id}">
        ${item.url ? `<img src="${item.url}" alt="${(item.caption || '').replace(/"/g, '&quot;')}">` : '<div class="gallery-item__placeholder">📷</div>'}
        <div class="gallery-item__overlay">
          <div class="gallery-item__actions">
            <button class="gallery-item__btn" onclick="deleteGalleryItem('${item.id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  return { all, find, add, remove, renderHTML };
})();
