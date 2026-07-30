/* ============================================
   Data API — Vercel Serverless Function
   Stores/retrieves all published data as a
   committed file in the GitHub repo.
   ============================================ */

const GITHUB_OWNER = 'shamansuryavamshi';
const GITHUB_REPO = 'MyBusiness';
const FILE_PATH = 'published-data.json';
const BRANCH = 'master';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
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
        const token = process.env.GH_TOKEN;
        if (!token) return res.status(200).json({ error: 'GH_TOKEN not set' });
        let data;
        try { data = JSON.parse(setParam); } catch (e) {
          return res.status(200).json({ error: 'Invalid JSON: ' + e.message });
        }
        const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

        // Get current file SHA if it exists
        let sha = null;
        const getRes = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
          { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
        );
        if (getRes.ok) {
          const existing = await getRes.json();
          sha = existing.sha;
        }

        // Create or update the file
        const body = { message: 'Publish data [automated]', content, branch: BRANCH };
        if (sha) body.sha = sha;
        const putRes = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
          { method: 'PUT', headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        if (!putRes.ok) {
          const err = await putRes.json().catch(() => ({}));
          return res.status(200).json({ error: err.message || 'GitHub API error', detail: err });
        }
        return res.status(200).json({ success: true });
      }

      // Read mode — fetch from raw GitHub
      const rawRes = await fetch(`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${BRANCH}/${FILE_PATH}`);
      if (!rawRes.ok) return res.status(200).json({});
      const raw = await rawRes.text();
      try { return res.status(200).json(JSON.parse(raw)); }
      catch { return res.status(200).json({}); }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(200).json({ error: e.message || String(e) });
  }
};
