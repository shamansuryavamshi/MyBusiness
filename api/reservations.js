/* ============================================
   RESERVATIONS API
   Manages reservations stored in the repo file
   reservations.json (same GitHub-repo database as
   api/data.js). Customer PII is NOT exposed through
   the public /api/data endpoint.

   Actions (POST):
     create  -> public, validates & appends a reservation
     update  -> admin, sets status (confirmed/cancelled/pending)
     delete  -> admin, removes a reservation
     reset   -> admin, clears all reservations (new weekly dessert)

   Every mutation also recomputes weeklyDessert.remaining
   in published-data.json (= quantity - reserved) so the
   public site counter and sold-out state stay in sync.
   ============================================ */

const GITHUB_OWNER = 'shamansuryavamshi';
const GITHUB_REPO = 'MyBusiness';
const BRANCH = 'master';
const RESERVATIONS_FILE = 'reservations.json';
const DATA_FILE = 'published-data.json';

function ghUrl(file) {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file}`;
}

async function readFile(token, file) {
  const res = await fetch(ghUrl(file) + '?ref=' + BRANCH, {
    headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) {
    if (res.status === 404) return { sha: null, data: null };
    throw new Error('GitHub read failed (HTTP ' + res.status + ')');
  }
  const meta = await res.json();
  let data = {};
  try {
    data = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf-8'));
  } catch (_) {}
  return { sha: meta.sha, data };
}

async function writeFile(token, file, sha, data) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message: 'Update reservations [automated]', content, branch: BRANCH };
  if (sha) body.sha = sha;
  const putRes = await fetch(ghUrl(file), {
    method: 'PUT',
    headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(err.message || 'GitHub API PUT error');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (typeof req.body === 'string') resolve(req.body);
    else if (req.body && typeof req.body === 'object') resolve(JSON.stringify(req.body));
    else {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    }
  });
}

function genId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function pad(n) { return String(n).padStart(2, '0'); }

function reservedQty(reservations) {
  return (reservations || [])
    .filter((r) => r.status === 'pending' || r.status === 'confirmed')
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
}

function recomputeRemaining(dessert, reservations) {
  const quantity = Math.max(0, Number(dessert && dessert.quantity) || 5);
  return Math.max(0, quantity - reservedQty(reservations));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GH_TOKEN;
  if (!token) return res.status(500).json({ error: 'GH_TOKEN not set' });

  try {
    // ---- GET: reservations list (admin) ----
    if (req.method === 'GET') {
      const { data } = await readFile(token, RESERVATIONS_FILE);
      const list = Array.isArray(data) ? data : [];
      return res.status(200).json({ success: true, reservations: list });
    }

    if (req.method !== 'POST' && req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON: ' + e.message });
    }
    const action = body.action || '';

    const dataRes = await readFile(token, DATA_FILE);
    let published = dataRes.data;
    if (!published || typeof published !== 'object') published = {};
    delete published.reservations;
    if (!published.weeklyDessert || typeof published.weeklyDessert !== 'object') published.weeklyDessert = { quantity: 5 };

    const resRes = await readFile(token, RESERVATIONS_FILE);
    let reservations = Array.isArray(resRes.data) ? resRes.data : [];
    const dessert = published.weeklyDessert;
    const remaining = recomputeRemaining(dessert, reservations);

    // ============ CREATE (public) ============
    if (action === 'create') {
      const name = String(body.name || '').trim();
      const mobile = String(body.mobile || '').trim();
      const quantity = Number(body.quantity);
      const notes = String(body.notes || '').trim();

      if (name.length < 2) return res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
      if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        return res.status(400).json({ error: 'Quantity must be between 1 and 5.' });
      }
      if (remaining <= 0) return res.status(409).json({ error: 'This week\'s dessert is sold out.' });
      if (quantity > remaining) {
        return res.status(400).json({ error: 'Only ' + remaining + ' piece' + (remaining === 1 ? '' : 's') + ' remaining.' });
      }

      const now = new Date();
      const reservation = {
        id: genId(),
        name,
        mobile,
        quantity,
        notes,
        dessertName: dessert.name || '',
        date: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()),
        time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
        createdAt: now.toISOString(),
        status: 'pending',
      };
      reservations.push(reservation);

      const newRemaining = recomputeRemaining(dessert, reservations);
      dessert.remaining = newRemaining;
      published.publishedAt = now.toISOString();

      await writeFile(token, DATA_FILE, dataRes.sha, published);
      await writeFile(token, RESERVATIONS_FILE, resRes.sha, reservations);

      return res.status(200).json({ success: true, reservation, remaining: newRemaining, reserved: reservedQty(reservations) });
    }

    // ============ UPDATE STATUS (admin) ============
    if (action === 'update') {
      const id = String(body.id || '');
      const status = String(body.status || '');
      if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }
      const target = reservations.find((r) => String(r.id) === id);
      if (!target) return res.status(404).json({ error: 'Reservation not found.' });
      target.status = status;
      target.updatedAt = new Date().toISOString();

      const newRemaining = recomputeRemaining(dessert, reservations);
      dessert.remaining = newRemaining;
      published.publishedAt = new Date().toISOString();

      await writeFile(token, DATA_FILE, dataRes.sha, published);
      await writeFile(token, RESERVATIONS_FILE, resRes.sha, reservations);

      return res.status(200).json({ success: true, remaining: newRemaining, reserved: reservedQty(reservations) });
    }

    // ============ DELETE (admin) ============
    if (action === 'delete') {
      const id = String(body.id || '');
      const before = reservations.length;
      const next = reservations.filter((r) => String(r.id) !== id);
      if (next.length === before) return res.status(404).json({ error: 'Reservation not found.' });

      const newRemaining = recomputeRemaining(dessert, next);
      dessert.remaining = newRemaining;
      published.publishedAt = new Date().toISOString();

      await writeFile(token, DATA_FILE, dataRes.sha, published);
      await writeFile(token, RESERVATIONS_FILE, resRes.sha, next);

      return res.status(200).json({ success: true, remaining: newRemaining, reserved: reservedQty(next) });
    }

    // ============ RESET (new weekly dessert) ============
    if (action === 'reset') {
      const quantity = Math.max(0, Number(dessert.quantity) || 5);
      dessert.remaining = quantity;
      dessert.available = true;
      published.publishedAt = new Date().toISOString();

      await writeFile(token, DATA_FILE, dataRes.sha, published);
      await writeFile(token, RESERVATIONS_FILE, resRes.sha, []);

      return res.status(200).json({ success: true, remaining: quantity, reserved: 0 });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
