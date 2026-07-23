/* ============================================
   CONFIG — Shared data structures & defaults
   All admin pages import this file.
   Replace localStorage calls with Firebase/
   Supabase SDK later — just swap the CRUD layer.
   ============================================ */

const STORAGE_KEYS = {
  AUTH: 'ss_auth',
  BUSINESS: 'ss_business',
  DESSERT: 'ss_weeklyDessert',
  DESSERT_HISTORY: 'ss_dessertHistory',
  LOCATION: 'ss_location',
  GALLERY: 'ss_gallery',
  REVIEWS: 'ss_reviews',
  ANNOUNCEMENTS: 'ss_announcements',
  WEBSITE: 'ss_websiteSettings',
  DARK_MODE: 'ss_darkMode',
};

const DEFAULT_BUSINESS = {
  name: 'Sweet Sundays',
  phone: '+91 98765 43210',
  whatsapp: '919876543210',
  email: 'hello@sweetsundays.in',
  instagram: 'sweetsundays.blr',
  operatingDay: 'Sunday',
  operatingHours: '10:00 AM – 8:00 PM',
  maxPieces: 5,
  status: 'open',
};

const DEFAULT_DESSERT = {
  name: 'Burnt Basque Cheesecake',
  description: 'A caramelised, smoky crust hides a velvety cream cheese centre. No flour, no fuss — just pure indulgence baked low and slow. Each slice is a labour of love.',
  price: '₹400',
  image: '',
  emoji: '🧀',
  color: '#8E82FF',
  quantity: 15,
  remaining: 8,
  available: true,
  serves: 'Serves 2–3',
  allergens: 'Contains dairy, eggs',
  pickupNote: 'Pick up cold. Best enjoyed within 24 hours.',
  badge: '',
};

const DEFAULT_LOCATION = {
  name: 'Koramangala Social Grounds',
  address: '4th Block, 80 Feet Road, Koramangala, Bangalore 560034',
  mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.5!2d77.6245!3d12.9352',
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Koramangala,+Bangalore',
  parking: 'Free parking available at the venue.',
  hours: 'Sunday: 10:00 AM – 8:00 PM',
};

const DEFAULT_WEBSITE = {
  heroTitle: 'SWEET SUNDAYS',
  heroDescription: 'One handcrafted dessert every Sunday. Limited pieces. When it\'s gone, it\'s gone.',
  seoTitle: 'Sweet Sundays | Homemade Desserts — Bangalore',
  seoDescription: 'Handcrafted homemade desserts available every Sunday in Bangalore.',
  seoKeywords: 'desserts, bangalore, homemade, sunday, bakery',
  footerText: 'Made with ❤️ in Bangalore.',
  announcementBanner: '',
  announcementBannerColor: '#D8FF63',
  announcementBannerTextColor: '#101010',
};

const DEFAULT_GALLERY = [
  { id: 1, url: '', caption: 'Tiramisu', category: 'desserts', order: 1 },
  { id: 2, url: '', caption: 'Cheesecake', category: 'desserts', order: 2 },
  { id: 3, url: '', caption: 'Our Kitchen', category: 'kitchen', order: 3 },
  { id: 4, url: '', caption: 'Sunday Setup', category: 'events', order: 4 },
];

const DEFAULT_REVIEWS = [
  { id: 1, name: 'Priya S.', rating: 5, text: 'The tiramisu is hands down the best I\'ve had in Bangalore. Every Sunday is worth the wait!', image: '', approved: true, date: '2026-06-29' },
  { id: 2, name: 'Arjun K.', rating: 5, text: 'Ordered the basque cheesecake for my wife\'s birthday. She loved it!', image: '', approved: true, date: '2026-06-22' },
  { id: 3, name: 'Meera R.', rating: 5, text: 'Found them on Instagram and now I\'m a regular. The pistachio rose cake is unbelievable.', image: '', approved: true, date: '2026-06-15' },
];

const DEFAULT_ANNOUNCEMENTS = [];

const DEFAULT_DESSERT_HISTORY = [
  { id: 1, name: 'Classic Tiramisu', price: '₹350', emoji: '🍰', color: '#8E82FF', description: 'Espresso-soaked ladyfingers layered with mascarpone cream.', date: '2026-06-29', status: 'sold', quantity: 12, sold: 12 },
  { id: 2, name: 'Matcha Mille Crêpe', price: '₹380', emoji: '🍵', color: '#D8FF63', description: '20 layers of paper-thin crêpes with matcha diplomat cream.', date: '2026-06-22', status: 'sold', quantity: 10, sold: 10 },
  { id: 3, name: 'Mango Passionfruit Tart', price: '₹320', emoji: '🥭', color: '#D8FF63', description: 'Buttery tart shell with passionfruit curd and Alphonso mangoes.', date: '2026-06-15', status: 'sold', quantity: 15, sold: 13 },
  { id: 4, name: 'Pistachio Rose Cake', price: '₹420', emoji: '🌹', color: '#8E82FF', description: 'Pistachio sponge with rose water buttercream.', date: '2026-06-08', status: 'sold', quantity: 8, sold: 8 },
];

/* ---------- CRUD Helpers (swap for API later) ---------- */
const DB = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};

/* ---------- Reusable delete helper ---------- */
function deleteById(storageKey, id) {
  const strId = String(id);
  let items = DB.get(storageKey, []);
  items = items.filter(item => String(item.id) !== strId);
  DB.set(storageKey, items);
  return items;
}

/* ---------- Seed defaults on first load ---------- */
function seedDefaults() {
  if (!DB.get(STORAGE_KEYS.BUSINESS, null)) DB.set(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  if (!DB.get(STORAGE_KEYS.DESSERT, null)) DB.set(STORAGE_KEYS.DESSERT, DEFAULT_DESSERT);
  if (!DB.get(STORAGE_KEYS.LOCATION, null)) DB.set(STORAGE_KEYS.LOCATION, DEFAULT_LOCATION);
  if (!DB.get(STORAGE_KEYS.WEBSITE, null)) DB.set(STORAGE_KEYS.WEBSITE, DEFAULT_WEBSITE);
  if (!DB.get(STORAGE_KEYS.GALLERY, null)) DB.set(STORAGE_KEYS.GALLERY, DEFAULT_GALLERY);
  if (!DB.get(STORAGE_KEYS.REVIEWS, null)) DB.set(STORAGE_KEYS.REVIEWS, DEFAULT_REVIEWS);
  if (!DB.get(STORAGE_KEYS.ANNOUNCEMENTS, null)) DB.set(STORAGE_KEYS.ANNOUNCEMENTS, DEFAULT_ANNOUNCEMENTS);
  if (!DB.get(STORAGE_KEYS.DESSERT_HISTORY, null)) DB.set(STORAGE_KEYS.DESSERT_HISTORY, DEFAULT_DESSERT_HISTORY);
}
seedDefaults();

/* ---------- Notify public site to reload ---------- */
function notifyPublicSite() {
  window.dispatchEvent(new Event('admin-updated'));
  try { localStorage.setItem('ss_lastUpdate', Date.now()); } catch {}
}

/* ---------- Generate unique ID ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Format date ---------- */
function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ---------- Next Sunday ---------- */
function getNextSunday() {
  const now = new Date();
  const diff = (7 - now.getDay()) % 7 || 7;
  const sun = new Date(now);
  sun.setDate(now.getDate() + diff);
  sun.setHours(10, 0, 0, 0);
  return sun;
}

function daysUntilSunday() {
  const diff = (7 - new Date().getDay()) % 7 || 7;
  return diff;
}
