import express from 'express';
import cors from 'cors';
import { env, clientOrigins } from './env';
import { healthRouter } from './routes/health';

const app = express();

app.use(cors({ origin: clientOrigins }));
app.use(express.json({ limit: env.MAX_BODY_SIZE }));

app.use('/api', healthRouter);

app.listen(env.PORT, () => {
  console.log(`▶ Nova server on http://localhost:${env.PORT}  (${env.NODE_ENV})`);
  console.log(`  CORS origins: ${clientOrigins.join(', ')}`);
});
