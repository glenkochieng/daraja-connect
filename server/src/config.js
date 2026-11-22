import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';

const SERVER_ROOT = path.resolve(import.meta.dirname, '..');

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: optionalString,
  JWT_SECRET: optionalString,
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  ML_SERVICE_URL: z.url().default('http://127.0.0.1:8000'),
  ML_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
  SEED_ON_START: z.enum(['auto', 'true', 'false']).default('auto'),
  SEED_DATA_DIR: optionalString,
  SEED_USER_PASSWORD: optionalString,
  ADMIN_NAME: z.string().default('Daraja Admin'),
  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD: optionalString,
});

/**
 * Validate environment variables and return a frozen, camelCase configuration.
 * Production refuses to start without a database URI and a strong JWT secret.
 */
export function loadConfig(env = process.env, { warn = console.warn } = {}) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';

  if (isProduction && !e.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in production');
  }
  let jwtSecret = e.JWT_SECRET;
  if (isProduction && (!jwtSecret || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET of at least 32 characters is required in production');
  }
  if (!jwtSecret) {
    jwtSecret = randomBytes(48).toString('hex');
    if (e.NODE_ENV === 'development') {
      warn(
        'JWT_SECRET is not set: using a random secret, so sessions end when the server restarts.',
      );
    }
  }

  return Object.freeze({
    env: e.NODE_ENV,
    isProduction,
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    mongodbUri: e.MONGODB_URI,
    jwtSecret,
    jwtExpiresIn: e.JWT_EXPIRES_IN,
    bcryptRounds: e.BCRYPT_ROUNDS,
    clientOrigins: e.CLIENT_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    mlServiceUrl: e.ML_SERVICE_URL,
    mlTimeoutMs: e.ML_TIMEOUT_MS,
    authRateLimit: e.AUTH_RATE_LIMIT,
    trustProxy: e.TRUST_PROXY,
    seedOnStart: e.SEED_ON_START,
    seedDataDir: e.SEED_DATA_DIR ?? path.resolve(SERVER_ROOT, '../ml-service/data/synthetic'),
    seedUserPassword: e.SEED_USER_PASSWORD,
    admin: { name: e.ADMIN_NAME, email: e.ADMIN_EMAIL, password: e.ADMIN_PASSWORD },
  });
}
