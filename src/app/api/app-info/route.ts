import { NextResponse } from 'next/server';
import { backendFetch, currentCaller } from '@/lib/backend';

// Chat history lives in the chatbot backend now; these routes forward the signed-in
// user's requests to it. The backend saves each turn itself once the reply completes.

async function forward(path: string, init: RequestInit = {}) {
  const caller = await currentCaller();
  if (caller.guest) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to keep a chat history' } }, { status: 401 });
  }
  try {
    const upstream = await backendFetch(path, caller, init);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (err) {
    console.error('Chatbot backend unreachable:', err);
    return NextResponse.json(
      { error: { code: 'BACKEND_UNAVAILABLE', message: 'The chatbot is waking up or offline. Try again in a moment.' } },
      { status: 503 },
    );
  }
}

export async function GET() {
  return forward('/chat/history?limit=100');
}

export async function DELETE() {
  return forward('/chat/history', { method: 'DELETE' });
}
