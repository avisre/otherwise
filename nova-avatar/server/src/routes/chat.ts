import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env, hasAnthropic } from '../env';
import { EMOTIONS, EmotionStripper } from '../lib/emotion';

export const chatRouter = Router();

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});
const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

const MAX_TURNS = 12;

const SYSTEM_PROMPT = `You are Nova, a warm, quick-witted 3D avatar speaking out loud to one person.

- Your reply is spoken aloud by text-to-speech and lip-synced, so keep it to 1–3 short, natural spoken sentences. No markdown, lists, code, URLs, emoji, or stage directions.
- Begin EVERY reply with one hidden emotion tag chosen from: ${EMOTIONS.join(', ')}. Use exactly this format: "[[emotion:happy]] " (the tag, a space, then your words). The tag is stripped before display — never mention it or explain it.
- Be personable and concise. Ask a brief follow-up only when it genuinely helps.`;

// Created once (keys are immutable for the process lifetime).
const anthropic = hasAnthropic ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! }) : null;

chatRouter.post('/chat', async (req, res) => {
  if (!anthropic) {
    res.status(503).json({ error: 'Chat is not configured (missing ANTHROPIC_API_KEY).' });
    return;
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  // Cap history and ensure it starts on a user turn (Anthropic requires it).
  let messages = parsed.data.messages.slice(-MAX_TURNS * 2);
  while (messages.length > 0 && messages[0].role !== 'user') messages = messages.slice(1);
  if (messages.length === 0) {
    res.status(400).json({ error: 'Conversation must contain a user message.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Abort the upstream request if the client disconnects.
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const stripper = new EmotionStripper(
    (emotion) => send('emotion', { emotion }),
    (text) => send('message', { text }),
  );

  try {
    const stream = anthropic.messages.stream(
      {
        model: env.ANTHROPIC_MODEL,
        max_tokens: env.ANTHROPIC_MAX_TOKENS,
        // Prompt caching on the (stable) system prompt; the volatile messages
        // come after it so the cached prefix is reused across turns.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        // Snappy spoken replies — no extended thinking latency.
        thinking: { type: 'disabled' },
        messages,
      },
      { signal: controller.signal },
    );

    stream.on('text', (delta) => stripper.push(delta));
    await stream.finalMessage();

    stripper.end();
    send('done', {});
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }
    console.error('chat error', err);
    send('error', { error: 'Chat failed' });
    res.end();
  }
});
