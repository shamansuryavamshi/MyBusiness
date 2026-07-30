const GITHUB_OWNER = 'shamansuryavamshi';
const GITHUB_REPO = 'MyBusiness';
const FILE_PATH = 'published-data.json';
const BRANCH = 'master';
const GH_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

function ghHeaders(token) {
  return { Authorization: token ? `token ${token}` : '', Accept: 'application/vnd.github.v3+json' };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const token = process.env.GH_TOKEN;

    // Parse ?set=QUERY_PARAM (write mode)
    const url = req.url || '';
    const qIdx = url.indexOf('?');
    const qs = qIdx >= 0 ? url.substring(qIdx + 1) : '';
    let setParam = '';
    if (qs) {
      const parts = qs.split('&');
      for (let i = 0; i < parts.length; i++) {
        const pair = parts[i].split('=');
        if (pair[0] === 'set' && pair.length > 1) {
          setParam = decodeURIComponent(pair[1].replace(/\+/g, ' '));
          break;
        }
      }
    }

    if (setParam) {
      if (!token) return res.status(500).json({ error: 'GH_TOKEN not set in Vercel env' });
      let data;
      try { data = JSON.parse(setParam); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in ?set: ' + e.message });
      }
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

      // Get current file SHA
      let sha = null;
      const getRes = await fetch(GH_API + '?ref=' + BRANCH, { headers: ghHeaders(token) });
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing.sha;
      }

      // Create or update
      const body = { message: 'Publish data [automated]', content, branch: BRANCH };
      if (sha) body.sha = sha;
      const putRes = await fetch(GH_API, {
        method: 'PUT',
        headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        return res.status(500).json({ error: err.message || 'GitHub API error', detail: err });
      }
      return res.status(200).json({ success: true });
    }

    // Read mode
    const getRes = await fetch(GH_API + '?ref=' + BRANCH, { headers: ghHeaders(token) });
    if (getRes.ok) {
      const file = await getRes.json();
      const decoded = Buffer.from(file.content, 'base64').toString('utf-8');
      try { return res.status(200).json(JSON.parse(decoded)); }
      catch { return res.status(200).json({}); }
    }
    return res.status(200).json({});
  } catch (e) {
    return res.status(200).json({ error: e.message || String(e) });
  }
};
