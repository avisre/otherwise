import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, clientOrigins } from './env';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { ttsRouter } from './routes/tts';

const app = express();

// Render (and most PaaS) put the app behind one proxy hop; needed for correct
// client IPs in rate limiting. Keep this specific — `true` is rejected by
// express-rate-limit's validation as too permissive.
app.set('trust proxy', 1);

app.use(
  helmet({
    // This is a JSON/audio API; the client is a separate static origin.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// Strict CORS: only the configured client origin(s). Requests with no Origin
// header (curl, same-origin, health checks) are allowed.
const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin || clientOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`Origin ${origin} is not allowed by CORS`));
  },
};
app.use(cors(corsOptions));

app.use(express.json({ limit: env.MAX_BODY_SIZE }));

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down.' },
});

// Health is unmetered; everything else under /api is rate-limited.
app.use('/api', healthRouter);
app.use('/api', apiLimiter);
app.use('/api', chatRouter);
app.use('/api', ttsRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler (CORS rejections, oversized bodies, etc.).
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const e = err as { type?: string; message?: string };
    if (e?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request too large' });
      return;
    }
    if (e?.message?.includes('CORS')) {
      res.status(403).json({ error: e.message });
      return;
    }
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  },
);

app.listen(env.PORT, () => {
  console.log(`▶ Nova server on http://localhost:${env.PORT}  (${env.NODE_ENV})`);
  console.log(`  CORS origins: ${clientOrigins.join(', ')}`);
});
