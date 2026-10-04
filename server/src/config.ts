import fs from 'node:fs';
import path from 'node:path';

// Safely load local .env file if present
const possibleEnvPaths = process.env.NODE_ENV === 'test' ? [
  path.resolve(process.cwd(), '.env.test'),
  path.resolve(process.cwd(), 'server', '.env.test'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
] : [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // Ignore load errors
    }
  }
}

const resolveResendApiKey = (): string => {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    return process.env.RESEND_API_KEY.trim();
  }
  // Safe backward-compatible fallback to SMTP_PASS: only if SMTP_HOST is resend and SMTP_PASS is a Resend API key
  const smtpPass = process.env.SMTP_PASS?.trim() || '';
  const smtpHost = process.env.SMTP_HOST?.trim() || '';
  if (smtpPass && smtpPass.startsWith('re_') && smtpHost.includes('resend')) {
    return smtpPass;
  }
  return '';
};

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  UPLOAD_DIR: path.resolve(process.cwd(), 'uploads'),
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ACCEPTED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  JWT_SECRET: process.env.JWT_SECRET || 'civictrust-mysuru-dev-secret-key-2026',
  JWT_EXPIRES_IN: '2h',
  OFFICER_INVITE_SECRET: process.env.OFFICER_INVITE_SECRET || 'MCC-OFFICER-SECRET-2026',
  DB_PATH: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'civictrust.db'),
  DATA_STORE: (process.env.DATA_STORE || 'sqlite') as 'sqlite' | 'supabase',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'complaint-evidence',
  RESEND_API_KEY: resolveResendApiKey(),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || '',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'CivicTrust Auth',
};

