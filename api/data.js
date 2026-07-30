const GITHUB_OWNER = 'shamansuryavamshi';
const GITHUB_REPO = 'MyBusiness';
const FILE_PATH = 'published-data.json';
const BRANCH = 'master';
const GH_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

module.exports = async (req, res) => {
  const trace = [];
  const log = (m) => { trace.push(m); console.log(m); };

  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const token = process.env.GH_TOKEN;
    log('token_set=' + !!token + ' len=' + (token ? token.length : 0));

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
    log('setParam_len=' + setParam.length);

    if (setParam) {
      if (!token) return res.status(500).json({ error: 'GH_TOKEN not set', trace });
      let data;
      try { data = JSON.parse(setParam); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON: ' + e.message, trace });
      }
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
      log('content_b64_len=' + content.length);

      // Get SHA
      log('fetching_sha...');
      const ghUrl1 = GH_API + '?ref=' + BRANCH;
      let sha = null;
      let getErr = null;
      try {
        const getRes = await fetch(ghUrl1, { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' } });
        log('sha_response_status=' + getRes.status);
        if (getRes.ok) {
          const existing = await getRes.json();
          sha = existing.sha;
          log('sha_found=' + !!sha);
        } else {
          const t = await getRes.text().catch(() => '');
          getErr = 'GET status=' + getRes.status + ' body=' + t.substring(0, 200);
          log(getErr);
        }
      } catch (e) {
        getErr = 'GET exception: ' + (e.message || e);
        log(getErr);
      }

      // PUT
      log('putting_file...sha=' + (sha || 'null'));
      const body = { message: 'Publish data [automated]', content, branch: BRANCH };
      if (sha) body.sha = sha;
      let putErr = null;
      let putStatus = 0;
      let putBody = '';
      try {
        const putRes = await fetch(GH_API, {
          method: 'PUT',
          headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        putStatus = putRes.status;
        putBody = await putRes.text().catch(() => '');
        log('put_response_status=' + putStatus);
        if (!putRes.ok) {
          putErr = 'PUT status=' + putStatus + ' body=' + putBody.substring(0, 300);
          log(putErr);
        }
      } catch (e) {
        putErr = 'PUT exception: ' + (e.message || e);
        log(putErr);
      }

      if (putErr) return res.status(200).json({ error: putErr, getErr, sha, trace });
      return res.status(200).json({ success: true, trace });
    }

    // Read mode
    log('read_mode');
    const ghUrl = GH_API + '?ref=' + BRANCH;
    try {
      const getRes = await fetch(ghUrl, { headers: { Authorization: token ? 'token ' + token : '', Accept: 'application/vnd.github.v3+json' } });
      log('read_status=' + getRes.status);
      if (getRes.ok) {
        const file = await getRes.json();
        const decoded = Buffer.from(file.content, 'base64').toString('utf-8');
        try { return res.status(200).json(JSON.parse(decoded)); }
        catch { return res.status(200).json({}); }
      }
    } catch (e) {
      log('read exception: ' + (e.message || e));
    }
    return res.status(200).json({});
  } catch (e) {
    log('top_level_catch: ' + (e.message || e));
    return res.status(200).json({ error: e.message || String(e), trace });
  }
};
