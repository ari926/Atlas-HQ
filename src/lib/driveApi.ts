// Frontend API client for the Google Drive proxy worker

import { isProduction } from './supabase';

const WORKER_URL = isProduction
  ? 'https://drive-proxy.ari-863.workers.dev'
  : 'http://localhost:8787';

// Shared secret for auth (set this in env or hardcode for dev)
const HQ_KEY = import.meta.env.VITE_HQ_SHARED_SECRET || 'dev-secret';

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

export interface DriveStatus {
  connected: boolean;
  rootFolderId?: string;
}

export interface FolderMapping {
  name: string;
  driveId: string;
  parentDriveId: string | null;
}

function headers(): HeadersInit {
  return { 'X-HQ-Key': HQ_KEY };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getDriveStatus(): Promise<DriveStatus> {
  return apiGet<DriveStatus>('/status');
}

export async function getAuthUrl(): Promise<string> {
  const data = await apiGet<{ url: string }>('/auth/url');
  return data.url;
}

export async function listFiles(folderId: string, pageToken?: string): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const params = new URLSearchParams({ folderId });
  if (pageToken) params.set('pageToken', pageToken);
  return apiGet(`/files?${params}`);
}

export async function getFile(fileId: string): Promise<DriveFile> {
  return apiGet(`/files/${fileId}`);
}

export async function getRevisions(fileId: string): Promise<DriveRevision[]> {
  return apiGet(`/files/${fileId}/revisions`);
}

export async function searchFiles(query: string): Promise<{ files: DriveFile[] }> {
  return apiGet(`/search?q=${encodeURIComponent(query)}`);
}

export async function uploadFile(folderId: string, file: File): Promise<DriveFile> {
  const res = await fetch(
    `${WORKER_URL}/files/upload?folderId=${folderId}&fileName=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      headers: {
        'X-HQ-Key': HQ_KEY,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: await file.arrayBuffer(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error || 'Upload failed');
  }
  return res.json() as Promise<DriveFile>;
}

export async function setupFolders(): Promise<{ rootFolderId: string; folders: FolderMapping[] }> {
  const res = await fetch(`${WORKER_URL}/setup-folders`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to setup folders');
  return res.json() as Promise<{ rootFolderId: string; folders: FolderMapping[] }>;
}

export async function disconnect(): Promise<void> {
  await fetch(`${WORKER_URL}/disconnect`, {
    method: 'DELETE',
    headers: headers(),
  });
}
