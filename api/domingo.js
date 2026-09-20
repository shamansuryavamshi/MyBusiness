/* ============================================
   DOMINGO HERO API — isolated from the existing site
   Manages the Domingo homepage hero dessert (name + image)
   stored in domingo-data.json in the SAME GitHub-repo
   database, but as a SEPARATE file so nothing about the
   existing website's published-data.json ever changes.

   GET           -> { hero: { name, image, updatedAt } }
   PUT / POST    -> body { hero: { name, image } }

   The hero image is uploaded through the existing
   /api/gdrive (Google Drive) and stored here as its
   public URL.
   ============================================ */

const GITHUB_OWNER = 'shamansuryavamshi';
const GITHUB_REPO = 'MyBusiness';
const FILE_PATH = 'domingo-data.json';
const BRANCH = 'master';
const GH_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

async function writeToGitHub(data, token) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  let sha = null;
  const getRes = await fetch(GH_API + '?ref=' + BRANCH, {
    headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' },
  });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }
  const body = { message: 'Update Domingo hero [automated]', content, branch: BRANCH };
  if (sha) body.sha = sha;
  const putRes = await fetch(GH_API, {
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = process.env.GH_TOKEN;

    if (req.method === 'PUT' || req.method === 'POST') {
      if (!token) return res.status(500).json({ error: 'GH_TOKEN not set' });
      const raw = await readBody(req);
      if (!raw) return res.status(400).json({ error: 'No data received' });
      let body;
      try { body = JSON.parse(raw); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON: ' + e.message });
      }
      const hero = (body && body.hero) || body || {};
      const name = String(hero.name == null ? '' : hero.name).trim();
      if (!name) return res.status(400).json({ error: 'Please enter a dessert name.' });
      const data = {
        hero: {
          name,
          image: String(hero.image == null ? '' : hero.image),
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
      await writeToGitHub(data, token);
      return res.status(200).json({ success: true, hero: data.hero });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const getRes = await fetch(GH_API + '?ref=' + BRANCH, {
      headers: { Authorization: token ? 'token ' + token : '', Accept: 'application/vnd.github.v3+json' },
    });
    if (getRes.ok) {
      const file = await getRes.json();
      const decoded = Buffer.from(file.content, 'base64').toString('utf-8');
      try {
        const data = JSON.parse(decoded);
        return res.status(200).json({ hero: (data && data.hero) || { name: '', image: '' } });
      } catch {
        return res.status(200).json({ hero: { name: '', image: '' } });
      }
    }
    return res.status(200).json({ hero: { name: '', image: '' } });
  } catch (e) {
    return res.status(200).json({ error: e.message || String(e) });
  }
};