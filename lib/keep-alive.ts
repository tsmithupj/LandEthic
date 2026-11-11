import { after } from 'next/server';

/**
 * For the slow AI requests (building a plan can take 2–3 minutes).
 *
 * Answers right away and sends a space every few seconds while the work runs,
 * then the JSON result at the end. Phones, Wi-Fi routers and some proxies drop a
 * connection that stays silent for a minute or more ("Failed to fetch"); a
 * trickle of spaces keeps it open. JSON allows leading spaces, so `res.json()`
 * on the browser side works unchanged.
 *
 * The HTTP status is always 200 once this starts, so failures come back as
 * `{ error }` in the body — callers must check for it.
 *
 * The work keeps running even if the visitor's connection drops, so anything it
 * saves (e.g. a rebuilt plan) is still saved.
 */
export function keepAliveJson(work: Promise<unknown>, everyMs = 5000): Response {
  const done = work.catch(() => undefined);
  try {
    after(() => done); // keep the server function alive until the work is finished
  } catch {
    // outside a request (tests) — nothing to keep alive
  }

  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
          return true;
        } catch {
          return false; // visitor already gone
        }
      };
      send(' ');
      timer = setInterval(() => { if (!send(' ')) clearInterval(timer); }, everyMs);
      work
        .then((body) => body, () => ({ error: 'Something went wrong. Please try again in a minute.' }))
        .then((body) => {
          clearInterval(timer);
          send(JSON.stringify(body));
          try { controller.close(); } catch { /* already closed */ }
        });
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
