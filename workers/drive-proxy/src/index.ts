// Atlas HQ — Google Drive Proxy Worker
// All Drive API calls are proxied through this worker for security.
// Tokens are encrypted at rest and never exposed to the frontend.

import type { Env } from './db';
import { getDriveConfig, upsertDriveConfig, deleteDriveConfig, upsertDocumentFolders } from './db';
import { encrypt, decrypt } from './crypto';
import { getAuthUrl, exchangeCode, refreshAccessToken } from './oauth';
import * as drive from './google';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Auth endpoints (no secret required)
      if (path === '/auth/url') {
        return corsResponse(env, json({ url: getAuthUrl(env) }));
      }
      if (path === '/auth/callback') {
        return handleCallback(url, env);
      }

      // All other endpoints require shared secret
      const secret = request.headers.get('X-HQ-Key');
      if (secret !== env.HQ_SHARED_SECRET) {
        return corsResponse(env, json({ error: 'Unauthorized' }, 401));
      }

      // Get a valid access token (auto-refresh if expired)
      const accessToken = await getValidAccessToken(env);

      if (path === '/status') {
        const config = await getDriveConfig(env);
        return corsResponse(env, json({
          connected: !!config?.access_token_encrypted,
          rootFolderId: config?.root_folder_id,
        }));
      }

      if (!accessToken) {
        return corsResponse(env, json({ error: 'Not connected to Google Drive', connected: false }, 401));
      }

      // File operations
      if (path === '/files' && request.method === 'GET') {
        const folderId = url.searchParams.get('folderId');
        if (!folderId) return corsResponse(env, json({ error: 'folderId required' }, 400));
        const pageToken = url.searchParams.get('pageToken') || undefined;
        const result = await drive.listFiles(accessToken, folderId, pageToken);
        return corsResponse(env, json(result));
      }

      if (path.match(/^\/files\/[^/]+$/) && request.method === 'GET') {
        const fileId = path.split('/')[2];
        const file = await drive.getFile(accessToken, fileId);
        return corsResponse(env, json(file));
      }

      if (path.match(/^\/files\/[^/]+\/revisions$/) && request.method === 'GET') {
        const fileId = path.split('/')[2];
        const revisions = await drive.getRevisions(accessToken, fileId);
        return corsResponse(env, json(revisions));
      }

      if (path === '/files/upload' && request.method === 'POST') {
        const folderId = url.searchParams.get('folderId');
        if (!folderId) return corsResponse(env, json({ error: 'folderId required' }, 400));
        const fileName = url.searchParams.get('fileName') || 'upload';
        const mimeType = request.headers.get('Content-Type') || 'application/octet-stream';
        const body = await request.arrayBuffer();
        const file = await drive.uploadFile(accessToken, folderId, fileName, mimeType, body);
        return corsResponse(env, json(file));
      }

      if (path === '/search' && request.method === 'GET') {
        const q = url.searchParams.get('q');
        if (!q) return corsResponse(env, json({ error: 'q required' }, 400));
        const config = await getDriveConfig(env);
        const files = await drive.searchFiles(accessToken, q, config?.root_folder_id || undefined);
        return corsResponse(env, json({ files }));
      }

      if (path === '/setup-folders' && request.method === 'POST') {
        const mappings = await drive.setupFolderHierarchy(accessToken);
        const rootMapping = mappings.find(m => m.name === 'Talaria HQ');

        // Store root folder ID
        if (rootMapping) {
          await upsertDriveConfig(env, { root_folder_id: rootMapping.driveId });
        }

        // Store folder mappings in hq_document_folders
        // Build parent_id references using drive IDs
        const folderRecords = mappings.map(m => ({
          name: m.name,
          parent_id: null as string | null, // Will be resolved by Supabase FK if needed
          google_drive_folder_id: m.driveId,
        }));
        await upsertDocumentFolders(env, folderRecords);

        return corsResponse(env, json({
          rootFolderId: rootMapping?.driveId,
          folders: mappings,
        }));
      }

      if (path === '/disconnect' && request.method === 'DELETE') {
        await deleteDriveConfig(env);
        return corsResponse(env, json({ success: true }));
      }

      return corsResponse(env, json({ error: 'Not found' }, 404));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return corsResponse(env, json({ error: message }, 500));
    }
  },
};

async function handleCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(`${env.HQ_REDIRECT_URL}?error=${error}`, 302);
  }
  if (!code) {
    return Response.redirect(`${env.HQ_REDIRECT_URL}?error=no_code`, 302);
  }

  const tokens = await exchangeCode(code, env);
  const accessEncrypted = await encrypt(tokens.access_token, env.ENCRYPTION_KEY);
  const refreshEncrypted = tokens.refresh_token
    ? await encrypt(tokens.refresh_token, env.ENCRYPTION_KEY)
    : null;

  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await upsertDriveConfig(env, {
    access_token_encrypted: accessEncrypted,
    refresh_token_encrypted: refreshEncrypted,
    token_expiry: expiry,
    connected_at: new Date().toISOString(),
    last_refreshed_at: new Date().toISOString(),
  });

  return Response.redirect(`${env.HQ_REDIRECT_URL}?connected=true`, 302);
}

async function getValidAccessToken(env: Env): Promise<string | null> {
  const config = await getDriveConfig(env);
  if (!config?.access_token_encrypted) return null;

  const accessToken = await decrypt(config.access_token_encrypted, env.ENCRYPTION_KEY);

  // Check if token is expired (with 5-minute buffer)
  if (config.token_expiry) {
    const expiry = new Date(config.token_expiry).getTime();
    if (Date.now() > expiry - 5 * 60 * 1000) {
      // Token expired, refresh it
      if (!config.refresh_token_encrypted) return null;
      const refreshToken = await decrypt(config.refresh_token_encrypted, env.ENCRYPTION_KEY);
      const newTokens = await refreshAccessToken(refreshToken, env);
      const newAccessEncrypted = await encrypt(newTokens.access_token, env.ENCRYPTION_KEY);
      const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await upsertDriveConfig(env, {
        access_token_encrypted: newAccessEncrypted,
        token_expiry: newExpiry,
        last_refreshed_at: new Date().toISOString(),
      });

      return newTokens.access_token;
    }
  }

  return accessToken;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsResponse(env: Env, response: Response): Response {
  const origins = env.ALLOWED_ORIGINS.split(',');
  const newHeaders = new Headers(response.headers);
  // In production, use the first allowed origin; in dev, allow all listed
  newHeaders.set('Access-Control-Allow-Origin', origins[0]);
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-HQ-Key, Authorization');
  newHeaders.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}
