/* ============================================
   Data API — Vercel Serverless Function
   Stores/retrieves all published data as a
   single JSON file in Google Drive.

   GET  /api/data        Retrieve all published data
   POST /api/data        Save all published data
   ============================================ */

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
      const data = await readDataFile();
      return res.status(200).json(data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const data = typeof req.body === 'object' ? req.body : (() => { try { return JSON.parse(req.body); } catch { return null; } })();
      if (!data) throw new Error('Invalid JSON body');
      await writeDataFile(data);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Data API error:', e);
    return res.status(500).json({ error: e.message || 'Failed to process data' });
  }
};
