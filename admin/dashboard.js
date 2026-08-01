/* ============================================
   DASHBOARD — All page logic
   Published content is read/written through the
   backend-backed StorageService (plus GalleryService
   and AnnouncementService). localStorage is used
   only for auth and dark mode.
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
  const escapeHTML = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escapeAttr = (s) => escapeHTML(s);

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
       SYNC ERROR HANDLING
       ============================================ */
  // Surface background-save failures so the admin knows a change did not
  // reach the website (e.g. payload too large -> HTTP 413).
  StorageService.setErrorHandler((msg) => toast(msg, 'error'));

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
    reservations: ['Reservations', 'Manage this week\'s dessert reservations'],
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
    const d = StorageService.get(STORAGE_KEYS.DESSERT, DEFAULT_DESSERT);
    const loc = StorageService.get(STORAGE_KEYS.LOCATION, DEFAULT_LOCATION);
    const biz = StorageService.get(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);

    $('#statDessert').textContent = d.name || '—';
    $('#statLocation').textContent = loc.name || '—';

    // Reservation summary
    const counts = ReservationService.counts();
    $('#rsvAvailable').textContent = counts.available;
    $('#rsvReserved').textContent = counts.reserved;
    $('#rsvRemaining').textContent = counts.remaining;
    $('#rsvPending').textContent = counts.pending;
    $('#rsvConfirmed').textContent = counts.confirmed;
    $('#rsvCancelled').textContent = counts.cancelled;

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
    const remaining = counts.remaining;
    if (remaining <= 2 && remaining > 0 && d.available) notifs.push({ type: 'danger', text: `Only ${remaining} piece${remaining > 1 ? 's' : ''} left!` });
    if (remaining === 0 && d.available) notifs.push({ type: 'danger', text: 'Dessert is sold out! Update the status.' });
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
      const d = StorageService.get(STORAGE_KEYS.DESSERT, DEFAULT_DESSERT);
      d.available = false;
      StorageService.set(STORAGE_KEYS.DESSERT, d);
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
    const d = StorageService.get(STORAGE_KEYS.DESSERT, DEFAULT_DESSERT);
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

    const derivedRemaining = ReservationService.remaining();
    setVal('dRemaining', derivedRemaining);

    currentDessertStatus = d.available ? 'available' : (derivedRemaining === 0 ? 'soldout' : 'hidden');
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
    const qty = parseInt(val('dQty')) || 5;
    const reserved = ReservationService.reservedQty();
    const remaining = Math.max(0, qty - reserved);

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
  ['dName', 'dPrice', 'dDesc', 'dEmoji', 'dServes', 'dAllergens', 'dPickup', 'dQty', 'dImage'].forEach(id => {
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
    const quantity = parseInt(val('dQty')) || 5;
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
      quantity: quantity,
      remaining: Math.max(0, quantity - ReservationService.reservedQty()),
      available: currentDessertStatus === 'available',
      badge: currentDessertBadge,
    };
    if (!d.name) { toast('Please enter a dessert name', 'error'); return; }
    StorageService.set(STORAGE_KEYS.DESSERT, d);
    refreshDashboard();
    toast('Dessert saved successfully', 'success');
  };

  // Publish to website
  $('#publishDessert').onclick = async () => {
    $('#saveDessert').click();
    try {
      const prevName = (ReservationService.dessert() && ReservationService.dessert().name) || '';
      const newName = val('dName') || '';
      const isNewDessert = prevName && newName && prevName !== newName;
      await API.publishAll();
      if (isNewDessert) {
        await ReservationService.reset();
        toast('New dessert published — reservations reset', 'info');
      }
      refreshDashboard();
      loadDessertEditor();
      toast('Dessert published to website!', 'success');
    } catch (e) {
      toast('Publish failed: ' + e.message, 'error');
    }
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
    const history = StorageService.get(STORAGE_KEYS.DESSERT_HISTORY, []) || [];
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
    const history = StorageService.get(STORAGE_KEYS.DESSERT_HISTORY, []) || [];
    const h = history.find(x => String(x.id) === String(id));
    if (!h) return;
    if (await confirmDialog(`Reuse "${h.name}" as this Sunday's dessert?`)) {
      StorageService.set(STORAGE_KEYS.DESSERT, {
        ...DEFAULT_DESSERT,
        name: h.name, price: h.price, emoji: h.emoji, color: h.color,
        description: h.description, quantity: 5, available: true,
        remaining: Math.max(0, 5 - ReservationService.reservedQty()),
        image: h.image || '', fileId: h.fileId || '',
      });
      navigateTo('dessert');
      loadDessertEditor();
      toast(`"${h.name}" is now this Sunday's dessert`, 'success');
    }
  };

  window.duplicateDessert = function (id) {
    const history = StorageService.get(STORAGE_KEYS.DESSERT_HISTORY, []) || [];
    const h = history.find(x => String(x.id) === String(id));
    if (!h) return;
    StorageService.set(STORAGE_KEYS.DESSERT, {
      ...DEFAULT_DESSERT,
      name: h.name + ' (Copy)', price: h.price, emoji: h.emoji, color: h.color,
      description: h.description, quantity: 5, available: true,
      remaining: Math.max(0, 5 - ReservationService.reservedQty()),
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
    const loc = StorageService.get(STORAGE_KEYS.LOCATION, DEFAULT_LOCATION);
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
    StorageService.set(STORAGE_KEYS.LOCATION, loc);
    refreshDashboard();
    toast('Location saved', 'success');
  };

  $('#publishLocation').onclick = async () => {
    $('#saveLocation').click();
    try {
      await API.publishAll();
      toast('Location published to website!', 'success');
    } catch (e) {
      toast('Publish failed: ' + e.message, 'error');
    }
  };

  /* ============================================
       GALLERY
       ============================================ */
  function loadGallery() {
    const gallery = GalleryService.all();
    const filter = ($('#galleryFilter') || {}).value || 'all';
    let items = gallery;
    if (filter !== 'all') items = items.filter(g => g.category === filter);

    const grid = $('#galleryGrid');
    const empty = $('#galleryEmpty');
    if (items.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    grid.innerHTML = items.map(g => GalleryService.renderHTML(g)).join('');
  }

  window.deleteGalleryItem = async function (id) {
    if (!await confirmDialog('Delete this image?')) return;
    await GalleryService.remove(id);
    loadGallery();
    toast('Deleted successfully', 'success');
  };

  if ($('#galleryFilter')) $('#galleryFilter').addEventListener('change', loadGallery);

  $('#addGalleryImage').onclick = () => $('#galleryFileInput').click();
  $('#galleryFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Uploading image...', 'info');
    GalleryService.add(file).then(() => {
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
    const reviews = StorageService.get(STORAGE_KEYS.REVIEWS, []) || [];
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

  window.toggleReview = async function (id, approved) {
    let reviews = StorageService.get(STORAGE_KEYS.REVIEWS, []) || [];
    const r = reviews.find(x => String(x.id) === String(id));
    if (r) { r.approved = approved; StorageService.set(STORAGE_KEYS.REVIEWS, reviews); loadReviews(); toast('Review updated', 'success'); }
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

  window.saveNewReview = async function () {
    const name = $('#mReviewName')?.value?.trim();
    const rating = parseInt($('#mReviewRating')?.value) || 5;
    const text = $('#mReviewText')?.value?.trim();
    if (!name || !text) { toast('Fill in all fields', 'error'); return; }
    const reviews = StorageService.get(STORAGE_KEYS.REVIEWS, []) || [];
    reviews.push({ id: uid(), name, rating, text, image: '', approved: false, date: new Date().toISOString() });
    StorageService.set(STORAGE_KEYS.REVIEWS, reviews);
    hideModal();
    loadReviews();
    toast('Review added', 'success');
  };

  /* ============================================
       ANNOUNCEMENTS
       ============================================ */
  const ANN_TYPES = ['General', 'New Dessert', 'Location Change', 'Holiday', 'Sold Out', 'Special Event'];

  function loadAnnouncements() {
    const items = AnnouncementService.all();
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

  window.toggleAnnouncePublish = async function (id) {
    const a = AnnouncementService.togglePublish(id);
    if (a) {
      loadAnnouncements();
      toast(a.isPublished ? 'Announcement published' : 'Announcement unpublished', 'success');
    }
  };

  window.toggleAnnouncePin = async function (id) {
    const target = AnnouncementService.togglePin(id);
    if (target) {
      loadAnnouncements();
      toast(target.isPinned ? 'Announcement pinned' : 'Announcement unpinned', 'success');
    }
  };

  window.editAnnouncement = function (id) {
    const a = AnnouncementService.find(id);
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

  window.saveEditAnnounce = async function (id) {
    const title = $('#mAnnTitle')?.value?.trim();
    const message = $('#mAnnMsg')?.value?.trim();
    if (!title) { toast('Enter a title', 'error'); return; }
    AnnouncementService.update(id, {
      title,
      message,
      type: $('#mAnnType')?.value || 'General',
      backgroundColor: $('#mAnnBg').value,
      textColor: $('#mAnnColor').value,
      startDate: $('#mAnnStart').value || null,
      endDate: $('#mAnnEnd').value || null,
    });
    hideModal();
    loadAnnouncements();
    toast('Announcement updated', 'success');
  };

  window.deleteAnnounce = async function (id) {
    if (!await confirmDialog('Delete this announcement?')) return;
    AnnouncementService.remove(id);
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

  window.saveNewAnnounce = async function () {
    const title = $('#mAnnTitle')?.value?.trim();
    const message = $('#mAnnMsg')?.value?.trim();
    if (!title) { toast('Enter a title', 'error'); return; }
    AnnouncementService.create({
      title,
      message: message || '',
      type: $('#mAnnType')?.value || 'General',
      backgroundColor: $('#mAnnBg').value,
      textColor: $('#mAnnColor').value,
      startDate: $('#mAnnStart').value || null,
      endDate: $('#mAnnEnd').value || null,
      isPublished: true,
      isPinned: false,
    });
    hideModal();
    loadAnnouncements();
    toast('Announcement created and published', 'success');
  };

  /* ============================================
       RESERVATIONS
       ============================================ */
  const RES_STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled' };
  let reservationsSearch = '';
  let reservationsFilter = 'all';
  let reservationsDate = '';
  let reservationsSort = 'newest';

  function loadReservations() {
    let items = ReservationService.all();

    if (reservationsSearch) {
      const q = reservationsSearch.toLowerCase();
      items = items.filter(r =>
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.mobile || '').includes(q) ||
        String(r.id || '').toLowerCase().includes(q));
    }
    if (reservationsFilter !== 'all') items = items.filter(r => r.status === reservationsFilter);
    if (reservationsDate) items = items.filter(r => String(r.date || '').startsWith(reservationsDate));

    items = [...items].sort((a, b) => {
      const ta = (a.createdAt || a.date || '').toString();
      const tb = (b.createdAt || b.date || '').toString();
      return reservationsSort === 'newest' ? tb.localeCompare(ta) : ta.localeCompare(tb);
    });

    const tbody = $('#reservationBody');
    const empty = $('#reservationEmpty');
    if (items.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = items.map(r => {
      const status = r.status || 'pending';
      const canConfirm = status === 'pending';
      const canCancel = status === 'pending' || status === 'confirmed';
      return `
      <tr data-id="${r.id}">
        <td><strong style="font-family:monospace;font-size:13px">${r.id}</strong></td>
        <td>${escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.mobile)}</td>
        <td>${escapeHTML(r.dessertName || '—')}</td>
        <td>${r.quantity || 1}</td>
        <td class="reservation-notes" title="${escapeAttr(r.notes || '')}">${escapeHTML(r.notes || '—')}</td>
        <td>${escapeHTML(r.date || '—')}</td>
        <td>${escapeHTML(r.time || '—')}</td>
        <td><span class="badge badge--${status}">${RES_STATUS_LABEL[status] || status}</span></td>
        <td>
          <div class="row-actions">
            ${canConfirm ? `<button class="row-btn row-btn--green" onclick="confirmReservation('${r.id}')">Confirm</button>` : ''}
            ${canCancel ? `<button class="row-btn" onclick="cancelReservation('${r.id}')">Cancel</button>` : ''}
            <button class="row-btn row-btn--red" onclick="deleteReservation('${r.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  window.confirmReservation = async function (id) {
    const r = ReservationService.all().find(x => String(x.id) === String(id));
    if (!r) return;
    if (!await confirmDialog(`Confirm reservation ${r.id} for ${r.name} (${r.quantity} pcs)?`)) return;
    try {
      await ReservationService.setStatus(id, 'confirmed');
      loadReservations();
      refreshDashboard();
      toast('Reservation confirmed', 'success');
    } catch (e) {
      toast('Failed: ' + e.message, 'error');
    }
  };

  window.cancelReservation = async function (id) {
    const r = ReservationService.all().find(x => String(x.id) === String(id));
    if (!r) return;
    if (!await confirmDialog(`Cancel reservation ${r.id} for ${r.name}?`)) return;
    try {
      await ReservationService.setStatus(id, 'cancelled');
      loadReservations();
      refreshDashboard();
      toast('Reservation cancelled', 'success');
    } catch (e) {
      toast('Failed: ' + e.message, 'error');
    }
  };

  window.deleteReservation = async function (id) {
    if (!await confirmDialog('Delete this reservation permanently?')) return;
    try {
      await ReservationService.remove(id);
      loadReservations();
      refreshDashboard();
      toast('Reservation deleted', 'success');
    } catch (e) {
      toast('Failed: ' + e.message, 'error');
    }
  };

  if ($('#reservationSearch')) $('#reservationSearch').addEventListener('input', (e) => { reservationsSearch = e.target.value; loadReservations(); });
  if ($('#reservationFilter')) $('#reservationFilter').addEventListener('change', (e) => { reservationsFilter = e.target.value; loadReservations(); });
  if ($('#reservationDate')) $('#reservationDate').addEventListener('change', (e) => { reservationsDate = e.target.value; loadReservations(); });
  if ($('#reservationSort')) $('#reservationSort').addEventListener('change', (e) => { reservationsSort = e.target.value; loadReservations(); });

  /* ============================================
       WEBSITE SETTINGS
       ============================================ */
  function loadWebsite() {
    const ws = StorageService.get(STORAGE_KEYS.WEBSITE, DEFAULT_WEBSITE);
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

  $('#saveWebsite').onclick = async () => {
    const ws = {
      heroTitle: val('wsHeroTitle'), heroDescription: val('wsHeroDesc'),
      seoTitle: val('wsSeoTitle'), seoDescription: val('wsSeoDesc'), seoKeywords: val('wsKeywords'),
      footerText: val('wsFooter'),
      announcementBanner: val('wsBanner'), announcementBannerColor: $('#wsBannerBg').value, announcementBannerTextColor: $('#wsBannerColor').value,
    };
    StorageService.set(STORAGE_KEYS.WEBSITE, ws);
    toast('Website settings saved', 'success');
  };

  /* ============================================
       BUSINESS SETTINGS
       ============================================ */
  let currentBizStatus = 'open';

  function loadBusiness() {
    const biz = StorageService.get(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
    setVal('bsName', biz.name);
    setVal('bsPhone', biz.phone);
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

  $('#saveBusiness').onclick = async () => {
    const biz = {
      name: val('bsName'), phone: val('bsPhone'),
      email: val('bsEmail'), instagram: val('bsInstagram'),
      operatingDay: val('bsDay'), operatingHours: val('bsHours'),
      maxPieces: parseInt(val('bsMax')) || 5, status: currentBizStatus,
      apiBaseUrl: val('bsApiUrl'),
    };
    StorageService.set(STORAGE_KEYS.BUSINESS, biz);
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
    if (e.key === 'r') navigateTo('reservations');
    if (e.key === 'n') toggleDark();
  });



  /* ============================================
       INIT
       ============================================ */
  (async () => {
    await StorageService.init();
    await ReservationService.refresh();
    refreshDashboard();
    loadDessertEditor();
    loadHistory();
    loadLocation();
    loadGallery();
    loadReviews();
    loadAnnouncements();
    loadWebsite();
    loadBusiness();
    loadReservations();
  })();

  // Poll for new customer reservations so the admin sees them instantly
  // (and re-sync the dashboard counters with the live dessert).
  setInterval(async () => {
    try {
      await ReservationService.refresh();
      refreshDashboard();
      loadReservations();
      if ($('#page-dessert') && $('#page-dessert').classList.contains('page--active')) loadDessertEditor();
    } catch (_) {}
  }, 15000);

})();
