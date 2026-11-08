/**
 * Thin wrapper around the Google Drive REST API (v3).
 *
 * Everything that talks to Drive lives here so that auth headers, error
 * handling and endpoint URLs exist in exactly one place.
 */

const API_BASE = 'https://www.googleapis.com/drive/v3';

/** Mime types the viewer is able to render. */
export const MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/ogg',
];

/**
 * Thrown when Drive rejects a request because the OAuth token is missing,
 * expired or revoked. Callers use this to send the user back to sign-in
 * instead of showing a generic error.
 */
export class AuthError extends Error {
  constructor(message = 'Your Google session expired. Please sign in again.') {
    super(message);
    this.name = 'AuthError';
  }
}

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
}

async function driveFetch(path, { token, method = 'GET', body, params, headers } = {}) {
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  });

  if (response.status === 401) {
    throw new AuthError();
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      /* body already consumed or unreadable — fall back to the status line */
    }
    throw new Error(detail || `Drive request failed with status ${response.status}`);
  }

  return response;
}

/** List every folder in the user's Drive (paginated). */
export async function listFolders(token) {
  const folders = [];
  let pageToken;

  do {
    // eslint-disable-next-line no-await-in-loop
    const response = await driveFetch('/files', {
      token,
      params: {
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'nextPageToken, files(id, name, parents)',
        pageSize: 1000,
        pageToken,
      },
    });
    // eslint-disable-next-line no-await-in-loop
    const data = await response.json();
    folders.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return folders;
}

/** List renderable media directly inside a folder (paginated). */
export async function listMediaInFolder(folderId, token, mimeTypes = MEDIA_MIME_TYPES) {
  const mimeQuery = mimeTypes.map((mime) => `mimeType='${mime}'`).join(' OR ');
  const files = [];
  let pageToken;

  do {
    // eslint-disable-next-line no-await-in-loop
    const response = await driveFetch('/files', {
      token,
      params: {
        q: `'${folderId}' in parents AND trashed=false AND (${mimeQuery})`,
        fields:
          'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink)',
        pageSize: 1000,
        pageToken,
      },
    });
    // eslint-disable-next-line no-await-in-loop
    const data = await response.json();
    files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

/** Download the raw bytes of a file. */
export async function fetchFileBlob(fileId, token) {
  const response = await driveFetch(`/files/${fileId}`, { token, params: { alt: 'media' } });
  return response.blob();
}

/** Move a file to the Drive trash. */
export async function trashFile(fileId, token) {
  await driveFetch(`/files/${fileId}`, {
    token,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

/** Copy a file into another folder. */
export async function copyFile(fileId, destinationFolderId, token) {
  await driveFetch(`/files/${fileId}/copy`, {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parents: [destinationFolderId] }),
  });
}
