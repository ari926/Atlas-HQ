// Google Drive API v3 client

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  createdTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  parents?: string[];
  owners?: { displayName: string; emailAddress: string }[];
  lastModifyingUser?: { displayName: string; emailAddress: string };
}

export interface DriveRevision {
  id: string;
  modifiedTime: string;
  lastModifyingUser?: { displayName: string; emailAddress: string };
  size?: string;
}

interface ListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listFiles(
  accessToken: string,
  folderId: string,
  pageToken?: string,
  pageSize = 100
): Promise<ListResponse> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,iconLink,thumbnailLink,webViewLink,parents,owners,lastModifyingUser)',
    orderBy: 'folder,name',
    pageSize: String(pageSize),
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<ListResponse>;
}

export async function getFile(accessToken: string, fileId: string): Promise<DriveFile> {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,size,modifiedTime,createdTime,iconLink,thumbnailLink,webViewLink,parents,owners,lastModifyingUser',
  });
  const res = await fetch(`${DRIVE_API}/files/${fileId}?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`Drive get failed: ${res.status}`);
  return res.json() as Promise<DriveFile>;
}

export async function getRevisions(accessToken: string, fileId: string): Promise<DriveRevision[]> {
  const params = new URLSearchParams({
    fields: 'revisions(id,modifiedTime,lastModifyingUser,size)',
  });
  const res = await fetch(`${DRIVE_API}/files/${fileId}/revisions?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`Drive revisions failed: ${res.status}`);
  const data = await res.json() as { revisions: DriveRevision[] };
  return data.revisions || [];
}

export async function searchFiles(accessToken: string, query: string, rootFolderId?: string): Promise<DriveFile[]> {
  let q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
  if (rootFolderId) {
    // Limit search to within the Talaria HQ folder tree
    // Note: Drive API doesn't support recursive parent search, so we search globally
    // and rely on the files being within the HQ folder hierarchy
  }
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,size,modifiedTime,createdTime,iconLink,thumbnailLink,webViewLink,parents,owners)',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
  });
  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`Drive search failed: ${res.status}`);
  const data = await res.json() as { files: DriveFile[] };
  return data.files || [];
}

export async function uploadFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  body: ArrayBuffer
): Promise<DriveFile> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  // Use multipart upload
  const boundary = '---hq-upload-boundary';
  const metaPart = JSON.stringify(metadata);
  const encoder = new TextEncoder();

  const parts = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaPart}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    new Uint8Array(body),
    encoder.encode(`\r\n--${boundary}--`),
  ];

  const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents',
  });

  const res = await fetch(`${UPLOAD_API}/files?${params}`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: combined,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<DriveFile>;
}

export async function createFolder(accessToken: string, name: string, parentId?: string): Promise<DriveFile> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];

  const res = await fetch(`${DRIVE_API}/files?fields=id,name,mimeType`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error(`Drive create folder failed: ${res.status}`);
  return res.json() as Promise<DriveFile>;
}

// Pre-built folder hierarchy for Talaria HQ
const FOLDER_HIERARCHY = {
  'Talaria HQ': {
    'Corporate': {},
    'Licenses': { 'PA': {}, 'WV': {} },
    'Insurance': {},
    'Compliance': {},
    'HR': {},
    'Vehicles': {},
    'Manifests': {},
    'Financial': {},
  },
};

interface FolderMapping {
  name: string;
  driveId: string;
  parentDriveId: string | null;
}

export async function setupFolderHierarchy(accessToken: string): Promise<FolderMapping[]> {
  const mappings: FolderMapping[] = [];

  async function createRecursive(
    structure: Record<string, Record<string, unknown>>,
    parentId?: string
  ) {
    for (const [name, children] of Object.entries(structure)) {
      const folder = await createFolder(accessToken, name, parentId);
      mappings.push({
        name,
        driveId: folder.id,
        parentDriveId: parentId || null,
      });
      if (children && Object.keys(children).length > 0) {
        await createRecursive(children as Record<string, Record<string, unknown>>, folder.id);
      }
    }
  }

  await createRecursive(FOLDER_HIERARCHY);
  return mappings;
}
