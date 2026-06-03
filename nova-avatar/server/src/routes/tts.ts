import { Router } from 'express';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { env, hasElevenLabs } from '../env';
import { EMOTION_TAG_RE } from '../lib/emotion';

export const ttsRouter = Router();

const BodySchema = z.object({
  text: z.string().min(1).max(1500),
});

ttsRouter.post('/tts', async (req, res) => {
  if (!hasElevenLabs) {
    res.status(503).json({ error: 'TTS is not configured (missing ELEVENLABS_API_KEY / VOICE_ID).' });
    return;
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  // Defensive: strip any stray emotion tag that slipped past the client.
  const text = parsed.data.text.replace(EMOTION_TAG_RE, '').trim();
  if (!text) {
    res.status(400).json({ error: 'Empty text' });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const url =
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID!)}` +
      `?output_format=mp3_44100_128`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: env.ELEVENLABS_MODEL_ID,
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      console.error('ElevenLabs error', upstream.status, detail.slice(0, 500));
      res.status(502).json({ error: 'TTS upstream error' });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    // Stream the audio bytes straight back to the client.
    const body = upstream.body as Parameters<typeof Readable.fromWeb>[0];
    Readable.fromWeb(body).pipe(res);
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }
    console.error('tts error', err);
    if (!res.headersSent) res.status(500).json({ error: 'TTS failed' });
    else res.end();
  }
});
