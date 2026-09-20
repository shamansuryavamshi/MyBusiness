/* ============================================
   Google Drive API — Vercel Serverless Function
   POST  /api/gdrive     Upload image
   DELETE /api/gdrive?id=FILE_ID  Delete image
   ============================================ */

const { google } = require('googleapis');
const { Readable } = require('stream');

/* ---------- Auth ---------- */
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

/* ---------- Folder cache ---------- */
const folderCache = {};

async function ensureFolder(parentId, name) {
  const d = drive();
  const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const res = await d.files.list({ q: query, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const created = await d.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id;
}

// Find the first shared drive the service account has access to.
async function findSharedDrive() {
  const d = drive();
  const res = await d.drives.list({ pageSize: 10, fields: 'drives(id)' });
  return (res.data.drives && res.data.drives[0] && res.data.drives[0].id) || null;
}

function isStorageQuotaError(e) {
  return /storage quota|Service Accounts do not have/i.test(e.message || '');
}

/* ---------- Upload ---------- */
async function uploadImage(base64Data, mimeType, folderName) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not set');

  const buf = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  // Preserve extension
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const createFile = async (parentId) => {
    const d = drive();
    const file = await d.files.create({
      requestBody: {
        name: filename,
        parents: [parentId],
      },
      media: { mimeType: mimeType || 'image/jpeg', body: Readable.from(buf) },
      fields: 'id',
      supportsAllDrives: true,
    });

    const fileId = file.data.id;

    // Make publicly viewable
    await d.permissions.create({
      fileId,
      requestBody: { type: 'anyone', role: 'reader' },
      supportsAllDrives: true,
    });

    return fileId;
  };

  const uploadTo = async (parentId) => {
    const folderId = await ensureFolder(parentId, folderName || 'DomingoHero');
    const fileId = await createFile(folderId);
    return fileId;
  };

  let fileId;
  try {
    fileId = await uploadTo(rootFolderId);
  } catch (e) {
    if (!isStorageQuotaError(e)) throw e;
    // Configured folder is in a location the service account cannot write to
    // (e.g. My Drive with no service-account quota). Fall back to a shared drive.
    const sharedDriveId = await findSharedDrive();
    if (sharedDriveId) {
      fileId = await uploadTo(sharedDriveId);
    } else {
      throw new Error('Google Drive storage is not available. Please configure a shared drive for this service account.');
    }
  }

  const publicImageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return { success: true, fileId, publicImageUrl, downloadUrl };
}

/* ---------- Delete ---------- */
async function deleteImage(fileId) {
  const d = drive();
  await d.files.delete({ fileId, supportsAllDrives: true });
  return { success: true };
}

/* ---------- Handler ---------- */
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const buffer = [];
      for await (const chunk of req) buffer.push(chunk);
      const raw = Buffer.concat(buffer).toString('utf-8');
      const { image, mimeType, folder } = JSON.parse(raw);
      if (!image) throw new Error('No image data provided');
      const result = await uploadImage(image, mimeType || 'image/jpeg', folder || 'FeaturedDesserts');
      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      const fileId = req.query.id || '';
      if (!fileId) throw new Error('No fileId provided');
      const result = await deleteImage(fileId);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Google Drive API error:', e);
    return res.status(500).json({ error: e.message || 'Upload failed' });
  }
};
