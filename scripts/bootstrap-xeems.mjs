import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const defaultCredentialsPath = path.join(os.homedir(), 'Desktop', 'GPS__SUPABASE.txt');

function escapeEnvValue(value) {
  return value.replace(/\r?\n/g, '').trim();
}

function parseCredentials(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');

  const projectId = raw.match(/Project ID:\s*([A-Za-z0-9_-]+)/i)?.[1]?.trim();
  const dbPassword = raw.match(/DB_PASSWORD:\s*([^\r\n]+)/i)?.[1]?.trim();
  const anonKey = raw.match(/Anon_Public_Key:\s*([^\r\n]+)/i)?.[1]?.trim();
  const serviceRoleKey = raw.match(/service_role_Key:\s*([^\r\n]+)/i)?.[1]?.trim();
  const expoToken = raw.match(/EXPO_Token:\s*([^\r\n]+)/i)?.[1]?.trim() ?? '';

  if (!projectId || !dbPassword || !anonKey || !serviceRoleKey) {
    throw new Error(`Unable to parse all required Supabase values from ${filePath}.`);
  }

  return {
    projectId,
    dbPassword,
    anonKey,
    serviceRoleKey,
    expoToken,
    supabaseUrl: `https://${projectId}.supabase.co`
  };
}

function upsertEnvFile(filePath, nextValues) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  const pending = new Map(Object.entries(nextValues).filter(([, value]) => value));
  const nextLines = [];

  for (const line of lines) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match) {
      nextLines.push(line);
      continue;
    }

    const key = match[1];
    if (pending.has(key)) {
      nextLines.push(`${key}=${escapeEnvValue(pending.get(key))}`);
      pending.delete(key);
    } else {
      nextLines.push(line);
    }
  }

  for (const [key, value] of pending) {
    nextLines.push(`${key}=${escapeEnvValue(value)}`);
  }

  const nextContent = `${nextLines.filter(Boolean).join('\n')}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextContent, 'utf8');
}

function getDatabaseCandidates(projectId, dbPassword) {
  const regions = [
    'eu-central-1',
    'eu-west-1',
    'us-east-1',
    'us-west-1',
    'us-west-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-south-1',
    'sa-east-1'
  ];

  const candidates = [
    {
      host: `db.${projectId}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password: dbPassword,
      label: 'direct'
    }
  ];

  for (const prefix of ['aws-0', 'aws-1']) {
    for (const region of regions) {
      for (const port of [6543, 5432]) {
        candidates.push({
          host: `${prefix}-${region}.pooler.supabase.com`,
          port,
          user: `postgres.${projectId}`,
          password: dbPassword,
          label: `${prefix}-${region}:${port}`
        });
      }
    }
  }

  return candidates;
}

async function connectToDatabase(credentials) {
  const errors = [];

  for (const candidate of getDatabaseCandidates(credentials.projectId, credentials.dbPassword)) {
    const client = new Client({
      host: candidate.host,
      port: candidate.port,
      database: 'postgres',
      user: candidate.user,
      password: candidate.password,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 4000
    });

    try {
      await client.connect();
      return {
        client,
        label: candidate.label,
        host: candidate.host,
        port: candidate.port,
        user: candidate.user
      };
    } catch (error) {
      errors.push(`${candidate.label} -> ${error instanceof Error ? error.message : String(error)}`);
      await client.end().catch(() => undefined);
    }
  }

  throw new Error(`Unable to connect to Supabase Postgres.\n${errors.join('\n')}`);
}

async function applySchema(credentials) {
  const schemaPath = path.join(repoRoot, 'supabase', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const connection = await connectToDatabase(credentials);
  const { client } = connection;

  try {
    await client.query(schemaSql);

    const adminCount = await client.query(
      "select count(*)::int as count from public.profiles where role = 'admin' and is_active = true"
    );

    return {
      adminCount: adminCount.rows[0]?.count ?? 0,
      connection
    };
  } finally {
    await client.end();
  }
}

async function ensureDownloadsBucket(credentials, desktopArtifactPath) {
  const supabase = createClient(credentials.supabaseUrl, credentials.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const existingBucket = await supabase.storage.getBucket('downloads');
  if (
    existingBucket.error &&
    existingBucket.error.message !== 'The resource was not found' &&
    existingBucket.error.message !== 'Bucket not found'
  ) {
    throw new Error(existingBucket.error.message);
  }

  if (!existingBucket.data) {
    const createdBucket = await supabase.storage.createBucket('downloads', {
      public: true,
      fileSizeLimit: 1073741824
    });

    if (createdBucket.error && !createdBucket.error.message.includes('already exists')) {
      throw new Error(createdBucket.error.message);
    }
  }

  const updatedBucket = await supabase.storage.updateBucket('downloads', {
    public: true,
    fileSizeLimit: 1073741824
  });

  if (updatedBucket.error) {
    throw new Error(updatedBucket.error.message);
  }

  if (!desktopArtifactPath || !fs.existsSync(desktopArtifactPath)) {
    return null;
  }

  const remoteName = path.basename(desktopArtifactPath).replace(/\s+/g, '-');
  const remotePath = `desktop/${remoteName}`;
  const artifact = fs.readFileSync(desktopArtifactPath);
  const upload = await supabase.storage.from('downloads').upload(remotePath, artifact, {
    contentType: 'application/vnd.microsoft.portable-executable',
    cacheControl: '3600',
    upsert: true
  });

  if (upload.error) {
    throw new Error(upload.error.message);
  }

  const publicUrl = supabase.storage.from('downloads').getPublicUrl(remotePath).data.publicUrl;
  return publicUrl;
}

function syncLocalEnv(credentials, desktopDownloadUrl) {
  upsertEnvFile(path.join(repoRoot, 'apps', 'web', '.env.local'), {
    NEXT_PUBLIC_SUPABASE_URL: credentials.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: credentials.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: credentials.serviceRoleKey,
    ...(desktopDownloadUrl ? { NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL: desktopDownloadUrl } : {})
  });

  const desktopValues = {
    SUPABASE_URL: credentials.supabaseUrl,
    SUPABASE_ANON_KEY: credentials.anonKey
  };

  upsertEnvFile(path.join(repoRoot, 'apps', 'desktop', '.env.local'), desktopValues);
  upsertEnvFile(path.join(repoRoot, 'apps', 'desktop', '.env'), desktopValues);

  const releaseEnvPath = path.join(repoRoot, 'apps', 'desktop', 'release', '.env');
  if (fs.existsSync(path.join(repoRoot, 'apps', 'desktop', 'release'))) {
    upsertEnvFile(releaseEnvPath, desktopValues);
  }

  upsertEnvFile(path.join(repoRoot, 'apps', 'mobile', '.env.local'), {
    EXPO_PUBLIC_SUPABASE_URL: credentials.supabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: credentials.anonKey
  });

  if (credentials.expoToken) {
    upsertEnvFile(path.join(repoRoot, '.env.local'), {
      EXPO_TOKEN: credentials.expoToken
    });
  }
}

async function main() {
  const credentialsPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCredentialsPath;

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at ${credentialsPath}`);
  }

  const credentials = parseCredentials(credentialsPath);
  const desktopArtifactPath = path.join(repoRoot, 'apps', 'desktop', 'release', 'XEEMS 1.0.0.exe');

  let schemaResult = null;
  let schemaError = null;

  try {
    schemaResult = await applySchema(credentials);
  } catch (error) {
    schemaError = error instanceof Error ? error : new Error(String(error));
  }

  let desktopDownloadUrl = null;
  let storageError = null;

  try {
    desktopDownloadUrl = await ensureDownloadsBucket(credentials, desktopArtifactPath);
  } catch (error) {
    storageError = error instanceof Error ? error : new Error(String(error));
  }

  syncLocalEnv(credentials, desktopDownloadUrl);

  console.log(`XEEMS bootstrap completed for project ${credentials.projectId}.`);
  if (schemaResult) {
    console.log(`Admin accounts found: ${schemaResult.adminCount}`);
    console.log(`Database connection: ${schemaResult.connection.label} (${schemaResult.connection.user}@${schemaResult.connection.host}:${schemaResult.connection.port})`);
  } else if (schemaError) {
    console.log('Schema application was skipped because the Postgres endpoint could not be resolved from the provided file.');
    console.log(schemaError.message);
  }
  if (storageError) {
    console.log('Desktop download upload was skipped.');
    console.log(storageError.message);
  }
  console.log(`Desktop download URL: ${desktopDownloadUrl ?? 'not published yet'}`);
  console.log('Local web, desktop, and mobile env files were updated.');
  if (credentials.expoToken) {
    console.log('Expo token was stored in local .env.local for command-line EAS usage.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
