const { google } = require('googleapis');

const DATA_FILE_NAME = 'published-data.json';

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  const credentials = JSON.parse(json);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

const drive = () => google.drive({ version: 'v3', auth: getAuth() });

async function findDataFile(folderId) {
  const d = drive();
  const query = `name='${DATA_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
  const res = await d.files.list({ q: query, fields: 'files(id, name)', pageSize: 1 });
  return res.data.files[0] || null;
}

async function readDataFile() {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not set');

  const file = await findDataFile(rootFolderId);
  if (!file) return {};

  const d = drive();
  const res = await d.files.get({ fileId: file.id, alt: 'media' });
  return res.data;
}

async function writeDataFile(data) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not set');

  const d = drive();
  const content = JSON.stringify(data, null, 2);
  const buf = Buffer.from(content, 'utf-8');

  let file = await findDataFile(rootFolderId);
  if (file) {
    await d.files.update({
      fileId: file.id,
      media: { mimeType: 'application/json', body: buf },
    });
  } else {
    file = await d.files.create({
      requestBody: { name: DATA_FILE_NAME, parents: [rootFolderId] },
      media: { mimeType: 'application/json', body: buf },
      fields: 'id',
    });
    await d.permissions.create({
      fileId: file.data.id,
      requestBody: { type: 'anyone', role: 'reader' },
    });
  }
  return { success: true };
}

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
        let parsed;
        try { parsed = JSON.parse(setParam); } catch (e) {
          return res.status(200).json({ op: 'parse_error', error: e.message, got: setParam.substring(0, 500) });
        }
        try {
          await writeDataFile(parsed);
          return res.status(200).json({ op: 'write_ok' });
        } catch (e) {
          return res.status(200).json({ op: 'write_error', error: e.message, stack: e.stack ? e.stack.split('\n') : [] });
        }
      }
      const data = await readDataFile();
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(200).json({ op: 'unexpected', error: e.message, stack: e.stack ? e.stack.split('\n') : [] });
  }
};
