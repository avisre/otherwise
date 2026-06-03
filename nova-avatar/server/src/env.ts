import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load env from the monorepo root (.env), then any local file, without
// overriding real env vars (Render injects them directly in production).
// __dirname resolves to server/src in dev (tsx) and server/dist in prod (node);
// both are one level under server/, so ../../.env points at nova-avatar/.env.
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });
dotenvConfig();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(1024),

  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_VOICE_ID: z.string().min(1).optional(),
  ELEVENLABS_MODEL_ID: z.string().default('eleven_turbo_v2_5'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  MAX_BODY_SIZE: z.string().default('64kb'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;

/** CLIENT_ORIGIN may be a comma-separated allowlist. */
export const clientOrigins = env.CLIENT_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
export const hasElevenLabs = Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID);

// Fail fast in production if external keys are missing; warn (but boot) in dev
// so Phase 0 / the avatar viewer work without credentials.
const missing: string[] = [];
if (!env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
if (!env.ELEVENLABS_API_KEY) missing.push('ELEVENLABS_API_KEY');
if (!env.ELEVENLABS_VOICE_ID) missing.push('ELEVENLABS_VOICE_ID');

if (missing.length > 0) {
  const msg = `Missing env vars: ${missing.join(', ')}`;
  if (env.NODE_ENV === 'production') {
    console.error(`❌ ${msg}`);
    process.exit(1);
  } else {
    console.warn(`⚠️  ${msg} — /api/chat and /api/tts will return 503 until configured.`);
  }
}
