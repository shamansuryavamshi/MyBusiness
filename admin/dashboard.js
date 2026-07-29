/* ============================================
   DASHBOARD — All page logic
   Modular, swap-ready for Firebase/Supabase.
   ============================================ */

(function () {
  'use strict';

  /* ---------- Auth Guard ---------- */
  const auth = DB.get(STORAGE_KEYS.AUTH, null);
  if (!auth || !auth.loggedIn) {
    window.location.href = 'login.html';
    return;
  }

  /* ---------- DOM Helpers ---------- */
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const val = (id) => $(`#${id}`).value.trim();
  const setVal = (id, v) => { const el = $(`#${id}`); if (el) el.value = v || ''; };

  /* ============================================
       TOAST
       ============================================ */
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = msg;
    $('#toastContainer').appendChild(el);
    setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, 3500);
  }

  /* ============================================
       MODAL
       ============================================ */
  function showModal(title, bodyHTML, footerHTML) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHTML;
    $('#modalFooter').innerHTML = footerHTML || '';
    $('#modalOverlay').classList.add('show');
  }

  function hideModal() { $('#modalOverlay').classList.remove('show'); }

  $('#modalClose').onclick = hideModal;
  $('#modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) hideModal(); });

  function confirmDialog(msg) {
    return new Promise((resolve) => {
      showModal('Confirm', `<p style="font-size:15px;line-height:1.6;color:var(--text-secondary)">${msg}</p>`,
        `<button class="btn btn--ghost" id="modalCancel">Cancel</button>
         <button class="btn btn--danger" id="modalConfirm">Confirm</button>`);
      $('#modalCancel').onclick = () => { hideModal(); resolve(false); };
      $('#modalConfirm').onclick = () => { hideModal(); resolve(true); };
    });
  }

  /* ============================================
       NAVIGATION
       ============================================ */
  const pageTitles = {
    dashboard: ['Dashboard', 'Overview of your Sunday business'],
    dessert: ['Weekly Dessert', 'Set this Sunday\'s featured dessert'],
    history: ['Dessert History', 'All previous Sunday desserts'],
    location: ['Location', 'Update this Sunday\'s selling location'],
    gallery: ['Gallery', 'Manage dessert and event photos'],
    reviews: ['Reviews', 'Customer reviews and ratings'],
    announcements: ['Announcements', 'Temporary notices for visitors'],
    website: ['Website Settings', 'Control what visitors see'],
    business: ['Business Settings', 'Core business information'],
  };

  window.navigateTo = function (page) {
    $$('.page').forEach(p => p.classList.remove('page--active'));
    $$('.sidebar__link').forEach(l => l.classList.remove('active'));
    const target = $(`#page-${page}`);
    if (target) target.classList.add('page--active');
    const link = $(`.sidebar__link[data-page="${page}"]`);
    if (link) link.classList.add('active');
    const [title, sub] = pageTitles[page] || [page, ''];
    $('#pageTitle').textContent = title;
    $('#pageSubtitle').textContent = sub;
    // Close mobile sidebar
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('show');
    window.scrollTo(0, 0);
  };

  $$('.sidebar__link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Mobile menu
  $('#menuToggle').onclick = () => { $('#sidebar').classList.toggle('open'); $('#sidebarOverlay').classList.toggle('show'); };
  $('#sidebarOverlay').onclick = () => { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show'); };

  // Logout
  $('#logoutBtn').onclick = async () => {
    if (await confirmDialog('Are you sure you want to logout?')) {
      DB.set(STORAGE_KEYS.AUTH, { loggedIn: false });
      window.location.href = 'login.html';
    }
  };

  /* ============================================
       DARK MODE
       ============================================ */
  function applyDark(dark) {
    document.body.classList.toggle('dark', dark);
  }
  const isDark = DB.get(STORAGE_KEYS.DARK_MODE, false);
  applyDark(isDark);

  function toggleDark() {
    const next = !document.body.classList.contains('dark');
    applyDark(next);
    DB.set(STORAGE_KEYS.DARK_MODE, next);
  }
  $('#darkToggle').onclick = toggleDark;
  $('#darkToggleMobile').onclick = toggleDark;

  /* ============================================
       DASHBOARD PAGE
       ============================================ */
  function refreshDashboard() {
    const d = DB.get(STORAGE_KEYS.DESSERT, DEFAULT_DESSERT);
    const loc = DB.get(STORAGE_KEYS.LOCATION, DEFAULT_LOCATION);
    const biz = DB.get(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);

    $('#statDessert').textContent = d.name || '—';
    $('#statLocation').textContent = loc.name || '—';

    const days = daysUntilSunday();
    $('#daysUntilSunday').textContent = days === 0 ? 'Today!' : days + ' day' + (days > 1 ? 's' : '');

    const statusEl = $('#businessStatus');
    const badgeEl = $('#businessStatusBadge');
    statusEl.textContent = biz.status.charAt(0).toUpperCase() + biz.status.slice(1);
    const dot = badgeEl.querySelector('.status-dot');
    dot.className = 'status-dot';
    if (biz.status === 'open') { dot.classList.add('status-dot--open'); badgeEl.childNodes[2].textContent = ' Open This Sunday'; }
    else if (biz.status === 'closed') { dot.classList.add('status-dot--closed'); badgeEl.childNodes[2].textContent = ' Closed'; }
    else { dot.classList.add('status-dot--holiday'); badgeEl.childNodes[2].textContent = ' Holiday'; }

    // Notifications
    const notifs = [];
    if (d.remaining <= 2 && d.remaining > 0 && d.available) notifs.push({ type: 'danger', text: `Only ${d.remaining} piece${d.remaining > 1 ? 's' : ''} left!` });
    if (d.remaining === 0 && d.available) notifs.push({ type: 'danger', text: 'Dessert is sold out! Update the status.' });
    if (!loc.name) notifs.push({ type: 'warning', text: 'No location set for this Sunday.' });
    if (days <= 1) notifs.push({ type: 'info', text: 'Sunday is' + (days === 0 ? ' today' : ' tomorrow') + '! Make sure everything is ready.' });

    const nl = $('#notificationsList');
    if (notifs.length === 0) {
      nl.innerHTML = '<p class="empty-state">All clear! No notifications.</p>';
    } else {
      nl.innerHTML = notifs.map(n => `<div class="notif-item notif-item--${n.type}">${n.text}</div>`).join('');
    }
  }

  // Quick action: Mark Sold Out
  $('#qaSoldOut').onclick = async () => {
    if (await confirmDialog('Mark this Sunday\'s dessert as sold out?')) {
      const d = DB.get(STORAGE_KEYS.DESSERT, DEFAULT_DESSERT);
      d.remaining = 0;
      d.available = false;
      DB.set(STORAGE_KEYS.DESSERT, d);
      refreshDashboard();
      loadDessertEditor();
      toast('Dessert marked as sold out', 'success');
    }
  };

  /* ============================================
       WEEKLY DESSERT EDITOR
       ============================================ */
  let currentDessertStatus = 'available';
  let currentDessertBadge = '';

  function loadDessertEditor() {
    const d = DB.get(STORAGE_KEYS.DESSERT, DEFAULT_DESSERT);
    setVal('dName', d.name);
    setVal('dPrice', d.price);
    setVal('dDesc', d.description);
    setVal('dEmoji', d.emoji);
    $('#dColor').value = d.color || '#8E82FF';
    setVal('dColorText', d.color || '#8E82FF');
    setVal('dServes', d.serves);
    setVal('dAllergens', d.allergens);
    setVal('dPickup', d.pickupNote);
    setVal('dImage', d.image);
    setVal('dFileId', d.fileId || '');
    setVal('dQty', d.quantity);
    setVal('dRemaining', d.remaining);

    currentDessertStatus = d.available ? 'available' : (d.remaining === 0 ? 'soldout' : 'hidden');
    currentDessertBadge = d.badge || '';

    $$('.toggle-btn[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === currentDessertStatus));
    $$('.toggle-btn[data-badge]').forEach(b => b.classList.toggle('active', b.dataset.badge === currentDessertBadge));

    updateDessertPreview();
  }

  function updateDessertPreview() {
    const name = val('dName') || 'Dessert Name';
    const price = val('dPrice') || '₹0';
    const desc = val('dDesc') || 'Description goes here...';
    const emoji = val('dEmoji') || '🎂';
    const color = $('#dColor').value || '#8E82FF';
    const serves = val('dServes');
    const qty = parseInt(val('dQty')) || 0;
    const remaining = parseInt(val('dRemaining')) || 0;

    $('#previewName').textContent = name;
    $('#previewDesc').textContent = desc;
    $('#previewPrice').textContent = price;
    $('#previewEmoji').textContent = emoji;
    $('#previewServes').textContent = serves;
    $('#previewImage').style.background = color;

    const fill = qty > 0 ? (remaining / qty) * 100 : 0;
    $('#previewStockFill').style.width = fill + '%';
    $('#previewStockText').textContent = `${remaining} of ${qty} remaining`;

    const statusEl = $('#previewStatus');
    if (currentDessertStatus === 'soldout') { statusEl.textContent = 'SOLD OUT'; statusEl.className = 'preview-card__status soldout'; }
    else if (currentDessertStatus === 'hidden') { statusEl.textContent = 'Hidden'; statusEl.className = 'preview-card__status hidden'; }
    else { statusEl.textContent = 'Available'; statusEl.className = 'preview-card__status'; }

    const badgeEl = $('#previewBadge');
    if (currentDessertBadge) { badgeEl.textContent = currentDessertBadge; badgeEl.style.display = 'block'; }
    else { badgeEl.style.display = 'none'; }

    // Image preview
    const img = val('dImage');
    const removeBtn = $('#removeDessertImage');
    if (img) {
      $('#previewEmoji').style.display = 'none';
      $('#previewImage').style.backgroundImage = `url(${img})`;
      $('#previewImage').style.backgroundSize = 'cover';
      $('#previewImage').style.backgroundPosition = 'center';
      if (removeBtn) removeBtn.style.display = 'flex';
    } else {
      $('#previewEmoji').style.display = 'block';
      $('#previewImage').style.backgroundImage = 'none';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  }

  // Live preview binding
  ['dName', 'dPrice', 'dDesc', 'dEmoji', 'dServes', 'dAllergens', 'dPickup', 'dQty', 'dRemaining', 'dImage'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.addEventListener('input', updateDessertPreview);
  });

  $('#dColor').addEventListener('input', (e) => { $('#dColorText').value = e.target.value; updateDessertPreview(); });
  $('#dColorText').addEventListener('input', (e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) { $('#dColor').value = e.target.value; updateDessertPreview(); } });

  // Status toggles
  $$('.toggle-btn[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.toggle-btn[data-status]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDessertStatus = btn.dataset.status;
      updateDessertPreview();
    });
  });

  // Badge toggles
  $$('.toggle-btn[data-badge]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.toggle-btn[data-badge]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDessertBadge = btn.dataset.badge;
      updateDessertPreview();
    });
  });

  // Save dessert
  $('#saveDessert').onclick = () => {
    const d = {
      name: val('dName'),
      price: val('dPrice'),
      description: val('dDesc'),
      emoji: val('dEmoji') || '🎂',
      color: $('#dColor').value,
      serves: val('dServes'),
      allergens: val('dAllergens'),
      pickupNote: val('dPickup'),
      image: val('dImage'),
      fileId: val('dFileId') || '',
      quantity: parseInt(val('dQty')) || 5,
      remaining: parseInt(val('dRemaining')) || 0,
      available: currentDessertStatus === 'available',
      badge: currentDessertBadge,
    };
    if (!d.name) { toast('Please enter a dessert name', 'error'); return; }
    DB.set(STORAGE_KEYS.DESSERT, d);
    refreshDashboard();
    toast('Dessert saved successfully', 'success');
  };

  // Publish to website
  $('#publishDessert').onclick = () => {
    $('#saveDessert').click();
    toast('Changes published to website!', 'success');
  };

  // Drag & drop
  const dz = $('#dessertDropzone');
  const fileInput = $('#dessertFile');
  dz.onclick = () => fileInput.click();
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('dragover'); handleImageFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleImageFile(e.target.files[0]); });
  $('#removeDessertImage').addEventListener('click', clearDessertImage);

  function handleImageFile(file) {
    if (!file) return;
    const dz = $('#dessertDropzone');
    dz.classList.add('dragover');
    dz.querySelector('p').textContent = 'Uploading...';
    toast('Uploading image...', 'info');
    ImageUpload.upload(file, 'FeaturedDesserts').then(result => {
      setVal('dImage', result.url);
      setVal('dFileId', result.fileId);
      updateDessertPreview();
      toast('Image uploaded successfully', 'success');
    }).catch(err => {
      toast(err.message || 'Image upload failed. Please try again.', 'error');
    }).finally(() => {
      dz.classList.remove('dragover');
      dz.querySelector('p').innerHTML = 'Drag & drop image here or <strong>click to browse</strong>';
    });
  }

  function clearDessertImage() {
    setVal('dImage', '');
    setVal('dFileId', '');
    updateDessertPreview();
  }

  /* ============================================
       DESSERT HISTORY
       ============================================ */
  function loadHistory() {
    const history = DB.get(STORAGE_KEYS.DESSERT_HISTORY, []);
    const search = ($('#historySearch') || {}).value?.toLowerCase() || '';
    const filter = ($('#historyFilter') || {}).value || 'all';

    let items = history;
    if (search) items = items.filter(h => h.name.toLowerCase().includes(search) || h.description.toLowerCase().includes(search));
    if (filter !== 'all') items = items.filter(h => h.status === filter);

    const tbody = $('#historyBody');
    const empty = $('#historyEmpty');
    if (items.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = items.map(h => `
      <tr>
        <td><strong>${h.emoji || ''} ${h.name}</strong></td>
        <td>${h.price}</td>
        <td>${fmtDate(h.date)}</td>
        <td>${h.sold || 0} / ${h.quantity}</td>
        <td><span class="badge badge--${h.status}">${h.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="row-btn row-btn--green" onclick="reuseDessert('${h.id}')">Reuse</button>
            <button class="row-btn" onclick="duplicateDessert('${h.id}')">Duplicate</button>
            <button class="row-btn row-btn--red" onclick="deleteDessertHistory('${h.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.reuseDessert = async function (id) {
    const history = DB.get(STORAGE_KEYS.DESSERT_HISTORY, []);
    const h = history.find(x => String(x.id) === String(id));
    if (!h) return;
    if (await confirmDialog(`Reuse "${h.name}" as this Sunday's dessert?`)) {
      DB.set(STORAGE_KEYS.DESSERT, {
        ...DEFAULT_DESSERT,
        name: h.name, price: h.price, emoji: h.emoji, color: h.color,
        description: h.description, quantity: 5, remaining: 5, available: true,
        image: h.image || '', fileId: h.fileId || '',
      });
      navigateTo('dessert');
      loadDessertEditor();
      toast(`"${h.name}" is now this Sunday's dessert`, 'success');
    }
  };

  window.duplicateDessert = function (id) {
    const history = DB.get(STORAGE_KEYS.DESSERT_HISTORY, []);
    const h = history.find(x => String(x.id) === String(id));
    if (!h) return;
    DB.set(STORAGE_KEYS.DESSERT, {
      ...DEFAULT_DESSERT,
      name: h.name + ' (Copy)', price: h.price, emoji: h.emoji, color: h.color,
      description: h.description, quantity: 5, remaining: 5, available: true,
      image: h.image || '', fileId: h.fileId || '',
    });
    navigateTo('dessert');
    loadDessertEditor();
    toast('Dessert duplicated to editor', 'info');
  };

  window.deleteDessertHistory = async function (id) {
    if (!await confirmDialog('Delete this dessert from history?')) return;
    deleteById(STORAGE_KEYS.DESSERT_HISTORY, id);
    loadHistory();
    toast('Deleted successfully', 'success');
  };

  if ($('#historySearch')) $('#historySearch').addEventListener('input', loadHistory);
  if ($('#historyFilter')) $('#historyFilter').addEventListener('change', loadHistory);

  /* ============================================
       LOCATION
       ============================================ */
  function loadLocation() {
    const loc = DB.get(STORAGE_KEYS.LOCATION, DEFAULT_LOCATION);
    setVal('locName', loc.name);
    setVal('locAddress', loc.address);
    setVal('locMap', loc.mapEmbed);
    setVal('locDirections', loc.directionsUrl);
    setVal('locParking', loc.parking);
    setVal('locHours', loc.hours);
    updateMapPreview();
  }

  function updateMapPreview() {
    const url = val('locMap');
    const frame = $('#mapFrame');
    const empty = $('#mapEmpty');
    if (url) { frame.src = url; frame.style.display = 'block'; empty.style.display = 'none'; }
    else { frame.style.display = 'none'; empty.style.display = 'block'; }
  }

  if ($('#locMap')) $('#locMap').addEventListener('input', updateMapPreview);

  $('#saveLocation').onclick = () => {
    const loc = { name: val('locName'), address: val('locAddress'), mapEmbed: val('locMap'), directionsUrl: val('locDirections'), parking: val('locParking'), hours: val('locHours') };
    if (!loc.name) { toast('Please enter a location name', 'error'); return; }
    DB.set(STORAGE_KEYS.LOCATION, loc);
    refreshDashboard();
    toast('Location saved', 'success');
  };

  $('#publishLocation').onclick = () => { $('#saveLocation').click(); toast('Location published to website!', 'success'); };

  /* ============================================
       GALLERY
       ============================================ */
  function loadGallery() {
    const gallery = DB.get(STORAGE_KEYS.GALLERY, []);
    const filter = ($('#galleryFilter') || {}).value || 'all';
    let items = gallery;
    if (filter !== 'all') items = items.filter(g => g.category === filter);

    const grid = $('#galleryGrid');
    const empty = $('#galleryEmpty');
    if (items.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    grid.innerHTML = items.map(g => `
      <div class="gallery-item" data-id="${g.id}">
        ${g.url ? `<img src="${g.url}" alt="${g.caption}">` : `<div class="gallery-item__placeholder">📷</div>`}
        <div class="gallery-item__overlay">
          <div class="gallery-item__actions">
            <button class="gallery-item__btn" onclick="deleteGalleryItem('${g.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.deleteGalleryItem = async function (id) {
    const gallery = DB.get(STORAGE_KEYS.GALLERY, []);
    const item = gallery.find(g => String(g.id) === String(id));
    if (!item) return;
    if (!await confirmDialog('Delete this image?')) return;
    // Delete from Google Drive if we have the fileId
    if (item.fileId) {
      try { await ImageUpload.remove(item.fileId); } catch (e) { console.warn('Failed to delete from Drive:', e); }
    }
    deleteById(STORAGE_KEYS.GALLERY, id);
    loadGallery();
    toast('Deleted successfully', 'success');
  };

  if ($('#galleryFilter')) $('#galleryFilter').addEventListener('change', loadGallery);

  $('#addGalleryImage').onclick = () => $('#galleryFileInput').click();
  $('#galleryFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Uploading image...', 'info');
    ImageUpload.upload(file, 'Gallery').then(result => {
      const gallery = DB.get(STORAGE_KEYS.GALLERY, []);
      gallery.push({ id: uid(), url: result.url, fileId: result.fileId, caption: file.name, category: 'desserts', order: gallery.length + 1 });
      DB.set(STORAGE_KEYS.GALLERY, gallery);
      loadGallery();
      toast('Image added to gallery', 'success');
    }).catch(err => {
      toast(err.message || 'Image upload failed. Please try again.', 'error');
    });
    e.target.value = '';
  });

  /* ============================================
       REVIEWS
       ============================================ */
  function loadReviews() {
    const reviews = DB.get(STORAGE_KEYS.REVIEWS, []);
    const list = $('#reviewsList');
    const empty = $('#reviewsEmpty');
    if (reviews.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    list.innerHTML = reviews.map(r => `
      <div class="review-item">
        <div>
          <div class="review-item__stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        </div>
        <div class="review-item__body">
          <div class="review-item__name">${r.name} <span class="badge badge--${r.approved ? 'confirmed' : 'pending'}" style="margin-left:8px">${r.approved ? 'Approved' : 'Pending'}</span></div>
          <div class="review-item__text">"${r.text}"</div>
          <div class="review-item__meta"><span>${fmtDate(r.date)}</span></div>
        </div>
        <div class="review-item__actions">
          ${!r.approved ? `<button class="row-btn row-btn--green" onclick="toggleReview('${r.id}', true)">Approve</button>` : `<button class="row-btn" onclick="toggleReview('${r.id}', false)">Hide</button>`}
          <button class="row-btn row-btn--red" onclick="deleteReview('${r.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  window.toggleReview = function (id, approved) {
    let reviews = DB.get(STORAGE_KEYS.REVIEWS, []);
    const r = reviews.find(x => String(x.id) === String(id));
    if (r) { r.approved = approved; DB.set(STORAGE_KEYS.REVIEWS, reviews); loadReviews(); toast('Review updated', 'success'); }
  };

  window.deleteReview = async function (id) {
    if (!await confirmDialog('Delete this review?')) return;
    deleteById(STORAGE_KEYS.REVIEWS, id);
    loadReviews();
    toast('Deleted successfully', 'success');
  };

  $('#addReview').onclick = () => {
    showModal('Add Review', `
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Customer Name</label><input type="text" id="mReviewName" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div>
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Rating (1-5)</label><input type="number" id="mReviewRating" min="1" max="5" value="5" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div>
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Review</label><textarea id="mReviewText" rows="3" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font);resize:vertical"></textarea></div>
    `, `<button class="btn btn--ghost" onclick="hideModal()">Cancel</button><button class="btn btn--primary" onclick="saveNewReview()">Save</button>`);
  };

  window.saveNewReview = function () {
    const name = $('#mReviewName')?.value?.trim();
    const rating = parseInt($('#mReviewRating')?.value) || 5;
    const text = $('#mReviewText')?.value?.trim();
    if (!name || !text) { toast('Fill in all fields', 'error'); return; }
    const reviews = DB.get(STORAGE_KEYS.REVIEWS, []);
    reviews.push({ id: uid(), name, rating, text, image: '', approved: false, date: new Date().toISOString() });
    DB.set(STORAGE_KEYS.REVIEWS, reviews);
    hideModal();
    loadReviews();
    toast('Review added', 'success');
  };

  /* ============================================
       ANNOUNCEMENTS
       ============================================ */
  const ANN_TYPES = ['General', 'New Dessert', 'Location Change', 'Holiday', 'Sold Out', 'Special Event'];

  function loadAnnouncements() {
    const items = DB.get(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const list = $('#announcementsList');
    const empty = $('#announcementsEmpty');
    if (items.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    list.innerHTML = items.map(a => {
      const statusBadge = a.isPublished
        ? '<span class="badge badge--confirmed">Published</span>'
        : '<span class="badge badge--hidden">Draft</span>';
      const pinBadge = a.isPinned ? '<span class="badge badge--warning" style="margin-left:6px">Pinned</span>' : '';
      const typeBadge = a.type ? `<span class="badge badge--info">${a.type}</span>` : '';
      const dateRange = [a.startDate, a.endDate].filter(Boolean).length === 2
        ? `${fmtDate(a.startDate)} – ${fmtDate(a.endDate)}`
        : a.startDate ? `From ${fmtDate(a.startDate)}` : a.endDate ? `Until ${fmtDate(a.endDate)}` : 'No date range';
      const isExpired = a.endDate && new Date(a.endDate) < new Date();
      const expiredBadge = isExpired ? '<span class="badge badge--danger" style="margin-left:6px">Expired</span>' : '';
      return `
      <div class="announce-item" style="border-left:4px solid ${a.backgroundColor || '#D8FF63'}">
        <div class="announce-item__header">
          <div>
            <span class="announce-item__text">${a.title || 'Untitled'}</span>
            ${typeBadge}${pinBadge}${expiredBadge}
          </div>
          ${statusBadge}
        </div>
        <div class="announce-item__message">${a.message || ''}</div>
        <div class="announce-item__preview" style="background:${a.backgroundColor || '#D8FF63'};color:${a.textColor || '#101010'}">${a.title || ''} — ${a.message || ''}</div>
        <div class="announce-item__meta">
          <span>${dateRange}</span>
          <span>Created: ${fmtDate(a.createdAt)}</span>
        </div>
        <div class="announce-item__actions">
          <button class="row-btn row-btn--green" onclick="toggleAnnouncePublish('${a.id}')">${a.isPublished ? 'Unpublish' : 'Publish'}</button>
          <button class="row-btn" onclick="toggleAnnouncePin('${a.id}')">${a.isPinned ? 'Unpin' : 'Pin'}</button>
          <button class="row-btn" onclick="editAnnouncement('${a.id}')">Edit</button>
          <button class="row-btn row-btn--red" onclick="deleteAnnounce('${a.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  window.toggleAnnouncePublish = function (id) {
    let items = DB.get(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const a = items.find(x => String(x.id) === String(id));
    if (a) {
      a.isPublished = !a.isPublished;
      a.updatedAt = new Date().toISOString();
      DB.set(STORAGE_KEYS.ANNOUNCEMENTS, items);
      loadAnnouncements();
      toast(a.isPublished ? 'Announcement published' : 'Announcement unpublished', 'success');
    }
  };

  window.toggleAnnouncePin = function (id) {
    let items = DB.get(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const target = items.find(x => String(x.id) === String(id));
    if (!target) return;
    if (target.isPinned) {
      target.isPinned = false;
    } else {
      items.forEach(a => { if (a.isPinned) a.isPinned = false; });
      target.isPinned = true;
    }
    target.updatedAt = new Date().toISOString();
    DB.set(STORAGE_KEYS.ANNOUNCEMENTS, items);
    loadAnnouncements();
    toast(target.isPinned ? 'Announcement pinned' : 'Announcement unpinned', 'success');
  };

  window.editAnnouncement = function (id) {
    const items = DB.get(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const a = items.find(x => String(x.id) === String(id));
    if (!a) return;
    const typeOptions = ANN_TYPES.map(t => `<option value="${t}" ${a.type === t ? 'selected' : ''}>${t}</option>`).join('');
    showModal('Edit Announcement', `
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Title</label><input type="text" id="mAnnTitle" value="${(a.title || '').replace(/"/g, '&quot;')}" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div>
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Message</label><textarea id="mAnnMsg" rows="3" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font);resize:vertical">${(a.message || '').replace(/</g, '&lt;')}</textarea></div>
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Type</label><select id="mAnnType" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)">${typeOptions}</select></div>
      <div style="display:flex;gap:12px;margin-bottom:16px"><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Background</label><input type="color" id="mAnnBg" value="${a.backgroundColor || '#D8FF63'}" style="width:100%;height:40px;padding:4px;cursor:pointer;border-radius:8px"></div><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Text Color</label><input type="color" id="mAnnColor" value="${a.textColor || '#101010'}" style="width:100%;height:40px;padding:4px;cursor:pointer;border-radius:8px"></div></div>
      <div style="display:flex;gap:12px;margin-bottom:0"><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Start Date</label><input type="date" id="mAnnStart" value="${a.startDate || ''}" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">End Date</label><input type="date" id="mAnnEnd" value="${a.endDate || ''}" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div></div>
    `, `<button class="btn btn--ghost" onclick="hideModal()">Cancel</button><button class="btn btn--primary" onclick="saveEditAnnounce('${a.id}')">Save Changes</button>`);
  };

  window.saveEditAnnounce = function (id) {
    const title = $('#mAnnTitle')?.value?.trim();
    const message = $('#mAnnMsg')?.value?.trim();
    if (!title) { toast('Enter a title', 'error'); return; }
    let items = DB.get(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const idx = items.findIndex(x => String(x.id) === String(id));
    if (idx === -1) return;
    items[idx] = {
      ...items[idx],
      title,
      message,
      type: $('#mAnnType')?.value || 'General',
      backgroundColor: $('#mAnnBg').value,
      textColor: $('#mAnnColor').value,
      startDate: $('#mAnnStart').value || null,
      endDate: $('#mAnnEnd').value || null,
      updatedAt: new Date().toISOString(),
    };
    DB.set(STORAGE_KEYS.ANNOUNCEMENTS, items);
    hideModal();
    loadAnnouncements();
    toast('Announcement updated', 'success');
  };

  window.deleteAnnounce = async function (id) {
    if (!await confirmDialog('Delete this announcement?')) return;
    deleteById(STORAGE_KEYS.ANNOUNCEMENTS, id);
    loadAnnouncements();
    toast('Deleted successfully', 'success');
  };

  $('#addAnnouncement').onclick = () => {
    const typeOptions = ANN_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
    showModal('New Announcement', `
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Title</label><input type="text" id="mAnnTitle" placeholder="e.g. Sold Out! See you next Sunday" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div>
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Message</label><textarea id="mAnnMsg" rows="3" placeholder="Additional details (optional)" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font);resize:vertical"></textarea></div>
      <div class="form-field" style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Type</label><select id="mAnnType" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)">${typeOptions}</select></div>
      <div style="display:flex;gap:12px;margin-bottom:16px"><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Background</label><input type="color" id="mAnnBg" value="#D8FF63" style="width:100%;height:40px;padding:4px;cursor:pointer;border-radius:8px"></div><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Text Color</label><input type="color" id="mAnnColor" value="#101010" style="width:100%;height:40px;padding:4px;cursor:pointer;border-radius:8px"></div></div>
      <div style="display:flex;gap:12px;margin-bottom:0"><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">Start Date</label><input type="date" id="mAnnStart" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div><div class="form-field" style="flex:1"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary)">End Date</label><input type="date" id="mAnnEnd" style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:var(--font)"></div></div>
    `, `<button class="btn btn--ghost" onclick="hideModal()">Cancel</button><button class="btn btn--primary" onclick="saveNewAnnounce()">Create & Publish</button>`);
  };

  window.saveNewAnnounce = function () {
    const title = $('#mAnnTitle')?.value?.trim();
    const message = $('#mAnnMsg')?.value?.trim();
    if (!title) { toast('Enter a title', 'error'); return; }
    const items = DB.get(STORAGE_KEYS.ANNOUNCEMENTS, []);
    items.unshift({
      id: uid(),
      title,
      message: message || '',
      type: $('#mAnnType')?.value || 'General',
      backgroundColor: $('#mAnnBg').value,
      textColor: $('#mAnnColor').value,
      startDate: $('#mAnnStart').value || null,
      endDate: $('#mAnnEnd').value || null,
      isPublished: true,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    DB.set(STORAGE_KEYS.ANNOUNCEMENTS, items);
    hideModal();
    loadAnnouncements();
    toast('Announcement created and published', 'success');
  };

  /* ============================================
       WEBSITE SETTINGS
       ============================================ */
  function loadWebsite() {
    const ws = DB.get(STORAGE_KEYS.WEBSITE, DEFAULT_WEBSITE);
    setVal('wsHeroTitle', ws.heroTitle);
    setVal('wsHeroDesc', ws.heroDescription);
    setVal('wsSeoTitle', ws.seoTitle);
    setVal('wsSeoDesc', ws.seoDescription);
    setVal('wsKeywords', ws.seoKeywords);
    setVal('wsFooter', ws.footerText);
    setVal('wsBanner', ws.announcementBanner);
    $('#wsBannerBg').value = ws.announcementBannerColor || '#D8FF63';
    $('#wsBannerColor').value = ws.announcementBannerTextColor || '#101010';
  }

  $('#saveWebsite').onclick = () => {
    const ws = {
      heroTitle: val('wsHeroTitle'), heroDescription: val('wsHeroDesc'),
      seoTitle: val('wsSeoTitle'), seoDescription: val('wsSeoDesc'), seoKeywords: val('wsKeywords'),
      footerText: val('wsFooter'),
      announcementBanner: val('wsBanner'), announcementBannerColor: $('#wsBannerBg').value, announcementBannerTextColor: $('#wsBannerColor').value,
    };
    DB.set(STORAGE_KEYS.WEBSITE, ws);
    toast('Website settings saved', 'success');
  };

  /* ============================================
       BUSINESS SETTINGS
       ============================================ */
  let currentBizStatus = 'open';

  function loadBusiness() {
    const biz = DB.get(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
    setVal('bsName', biz.name);
    setVal('bsPhone', biz.phone);
    setVal('bsWhatsApp', biz.whatsapp);
    setVal('bsEmail', biz.email);
    setVal('bsInstagram', biz.instagram);
    setVal('bsDay', biz.operatingDay);
    setVal('bsHours', biz.operatingHours);
    setVal('bsMax', biz.maxPieces);
    setVal('bsApiUrl', biz.apiBaseUrl || '');
    currentBizStatus = biz.status || 'open';
    $$('.toggle-btn[data-bsstatus]').forEach(b => b.classList.toggle('active', b.dataset.bsstatus === currentBizStatus));
    // Apply API base URL to ImageUpload
    if (biz.apiBaseUrl) window.API_BASE_URL = biz.apiBaseUrl;
  }

  $$('.toggle-btn[data-bsstatus]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.toggle-btn[data-bsstatus]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBizStatus = btn.dataset.bsstatus;
    });
  });

  $('#saveBusiness').onclick = () => {
    const biz = {
      name: val('bsName'), phone: val('bsPhone'), whatsapp: val('bsWhatsApp'),
      email: val('bsEmail'), instagram: val('bsInstagram'),
      operatingDay: val('bsDay'), operatingHours: val('bsHours'),
      maxPieces: parseInt(val('bsMax')) || 5, status: currentBizStatus,
      apiBaseUrl: val('bsApiUrl'),
    };
    DB.set(STORAGE_KEYS.BUSINESS, biz);
    // Apply API base URL immediately
    if (biz.apiBaseUrl) window.API_BASE_URL = biz.apiBaseUrl;
    refreshDashboard();
    toast('Business settings saved', 'success');
  };

  /* ============================================
       KEYBOARD SHORTCUTS
       ============================================ */
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'd') navigateTo('dashboard');
    if (e.key === 'w') navigateTo('dessert');
    if (e.key === 'l') navigateTo('location');
    if (e.key === 'g') navigateTo('gallery');
    if (e.key === 'n') toggleDark();
  });

  /* ============================================
       MIGRATION — Convert base64 images to cloud URLs
       ============================================ */
  async function migrateBase64Images() {
    let migrated = 0;
    // Dessert image
    const dessert = DB.get(STORAGE_KEYS.DESSERT, null);
    if (dessert && ImageUpload.isBase64(dessert.image)) {
      try {
        const result = await ImageUpload.migrateBase64(dessert.image, 'FeaturedDesserts');
        dessert.image = result.url;
        dessert.fileId = result.fileId || '';
        DB.set(STORAGE_KEYS.DESSERT, dessert);
        migrated++;
      } catch (e) { console.warn('Dessert image migration failed:', e.message); }
    }
    // Gallery images
    const gallery = DB.get(STORAGE_KEYS.GALLERY, []);
    let galleryDirty = false;
    for (const g of gallery) {
      if (ImageUpload.isBase64(g.url)) {
        try {
          const result = await ImageUpload.migrateBase64(g.url, 'Gallery');
          g.url = result.url;
          g.fileId = result.fileId || '';
          galleryDirty = true;
          migrated++;
        } catch (e) { console.warn('Gallery image migration failed:', e.message); }
      }
    }
    if (galleryDirty) DB.set(STORAGE_KEYS.GALLERY, gallery);
    if (migrated > 0) {
      toast(`Migrated ${migrated} image(s) to Google Drive`, 'success');
    }
  }

  /* Run migration on load (silently) */
  migrateBase64Images().catch(() => {});

  /* ============================================
       INIT
       ============================================ */
  refreshDashboard();
  loadDessertEditor();
  loadHistory();
  loadLocation();
  loadGallery();
  loadReviews();
  loadAnnouncements();
  loadWebsite();
  loadBusiness();

})();
