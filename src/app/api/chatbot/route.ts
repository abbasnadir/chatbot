import { NextResponse } from 'next/server';
import { backendFetch, currentCaller } from '@/lib/backend';

// Forwards the message to the chatbot backend and passes its event stream straight through,
// so the reply appears in the browser as it is generated.
export async function POST(req: Request) {
  let message: unknown;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await backendFetch('/chat', await currentCaller(), {
      method: 'POST',
      body: JSON.stringify({ message }),
      signal: req.signal,
    });
  } catch (err) {
    console.error('Chatbot backend unreachable:', err);
    return NextResponse.json(
      { error: { code: 'BACKEND_UNAVAILABLE', message: 'The chatbot is waking up or offline. Try again in a moment.' } },
      { status: 503 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // The backend already answers with { error: { code, message } }.
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
