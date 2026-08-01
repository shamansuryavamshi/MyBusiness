/* ============================================
   ANNOUNCEMENT SERVICE — create / edit / publish / pin / delete
   Persisted to the shared backend via StorageService,
   so announcements appear on every device immediately.
   ============================================ */

const AnnouncementService = (() => {
  function all() {
    return StorageService.get(STORAGE_KEYS.ANNOUNCEMENTS, []) || [];
  }

  function find(id) {
    return all().find((a) => String(a.id) === String(id));
  }

  function save(items) {
    StorageService.set(STORAGE_KEYS.ANNOUNCEMENTS, items);
    return items;
  }

  function create(data) {
    const items = all();
    const item = Object.assign({
      id: uid(),
      title: '',
      message: '',
      type: 'General',
      backgroundColor: '#678D58',
      textColor: '#FFFFFF',
      startDate: null,
      endDate: null,
      isPublished: true,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, data);
    items.unshift(item);
    save(items);
    return item;
  }

  function update(id, patch) {
    const items = all();
    const idx = items.findIndex((a) => String(a.id) === String(id));
    if (idx === -1) return null;
    items[idx] = Object.assign({}, items[idx], patch, { updatedAt: new Date().toISOString() });
    save(items);
    return items[idx];
  }

  function togglePublish(id) {
    const items = all();
    const a = items.find((x) => String(x.id) === String(id));
    if (!a) return null;
    a.isPublished = !a.isPublished;
    a.updatedAt = new Date().toISOString();
    save(items);
    return a;
  }

  function togglePin(id) {
    const items = all();
    const target = items.find((x) => String(x.id) === String(id));
    if (!target) return null;
    if (target.isPinned) {
      target.isPinned = false;
    } else {
      items.forEach((a) => { if (a.isPinned) a.isPinned = false; });
      target.isPinned = true;
    }
    target.updatedAt = new Date().toISOString();
    save(items);
    return target;
  }

  function remove(id) {
    const items = all().filter((a) => String(a.id) !== String(id));
    save(items);
    return items;
  }

  return { all, find, create, update, togglePublish, togglePin, remove };
})();
