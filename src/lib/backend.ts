import { SignJWT } from 'jose';
import { headers } from 'next/headers';
import { auth } from '@/app/auth';

// Calls the chatbot backend from the Next.js server. The browser never talks to the backend:
// each request carries a token signed here that lives five minutes and names the caller,
// either the signed-in user's id or "guest:<ip>".

const secret = () => {
  const value = process.env.BACKEND_JWT_SECRET;
  if (!value) throw new Error('BACKEND_JWT_SECRET is not set');
  return new TextEncoder().encode(value);
};

const baseUrl = () => {
  const value = process.env.BACKEND_URL;
  if (!value) throw new Error('BACKEND_URL is not set');
  return value.replace(/\/$/, '');
};

export type Caller = { id: string; email?: string; guest: boolean };

export async function currentCaller(): Promise<Caller> {
  const session = await auth();
  if (session?.user?.id) {
    return { id: session.user.id, email: session.user.email ?? undefined, guest: false };
  }
  // On Vercel the first x-forwarded-for entry is the client address, set by Vercel's edge.
  const forwarded = (await headers()).get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return { id: `guest:${ip}`, guest: true };
}

async function tokenFor(caller: Caller) {
  return new SignJWT(caller.email ? { email: caller.email } : {})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(caller.id)
    .setIssuer('chatbot-web')
    .setAudience('chatbot-backend')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret());
}

export async function backendFetch(path: string, caller: Caller, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await tokenFor(caller)}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  return fetch(`${baseUrl()}${path}`, { ...init, headers, cache: 'no-store' });
}
