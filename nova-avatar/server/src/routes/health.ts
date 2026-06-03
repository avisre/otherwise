import { Router } from 'express';
import { env, hasAnthropic, hasElevenLabs } from '../env';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'nova-server',
    env: env.NODE_ENV,
    chat: hasAnthropic,
    tts: hasElevenLabs,
    ts: Date.now(),
  });
});
