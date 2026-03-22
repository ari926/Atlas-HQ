// Supabase service-role client for reading/writing hq_drive_config

export interface DriveConfig {
  id: string;
  user_id: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expiry: string | null;
  root_folder_id: string | null;
  connected_at: string;
  last_refreshed_at: string | null;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENCRYPTION_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  HQ_SHARED_SECRET: string;
  ALLOWED_ORIGINS: string;
  HQ_REDIRECT_URL: string;
}

function supabaseHeaders(env: Env) {
  return {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

export async function getDriveConfig(env: Env): Promise<DriveConfig | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/hq_drive_config?limit=1`, {
    headers: supabaseHeaders(env),
  });
  const data = await res.json() as DriveConfig[];
  return data.length > 0 ? data[0] : null;
}

export async function upsertDriveConfig(env: Env, config: Partial<DriveConfig>): Promise<DriveConfig> {
  const existing = await getDriveConfig(env);
  if (existing) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/hq_drive_config?id=eq.${existing.id}`, {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify(config),
    });
    const data = await res.json() as DriveConfig[];
    return data[0];
  } else {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/hq_drive_config`, {
      method: 'POST',
      headers: supabaseHeaders(env),
      body: JSON.stringify(config),
    });
    const data = await res.json() as DriveConfig[];
    return data[0];
  }
}

export async function deleteDriveConfig(env: Env): Promise<void> {
  const existing = await getDriveConfig(env);
  if (existing) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/hq_drive_config?id=eq.${existing.id}`, {
      method: 'DELETE',
      headers: supabaseHeaders(env),
    });
  }
}

export async function upsertDocumentFolders(env: Env, folders: { name: string; parent_id: string | null; google_drive_folder_id: string }[]): Promise<void> {
  for (const folder of folders) {
    // Check if folder already exists by google_drive_folder_id
    const checkRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/hq_document_folders?google_drive_folder_id=eq.${folder.google_drive_folder_id}&limit=1`,
      { headers: supabaseHeaders(env) }
    );
    const existing = await checkRes.json() as { id: string }[];
    if (existing.length === 0) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/hq_document_folders`, {
        method: 'POST',
        headers: supabaseHeaders(env),
        body: JSON.stringify(folder),
      });
    }
  }
}
