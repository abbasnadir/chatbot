# chatbot

A chat app with sign-in and saved conversations. Replies stream in from Google Gemini through my own backend, [chatbot-backend](https://github.com/abbasnadir/chatbot-backend).

- **Next.js 16** with NextAuth (email and password, bcrypt hashes in MongoDB).
- The browser only talks to this app. Its `/api/chatbot` route signs a five-minute token for the caller (the user’s id, or `guest:<ip>`) and passes the backend’s event stream straight through, so replies appear as they are generated.
- Signed-in users get their history and their recent messages as context; guests can chat without either.
- Daily limits, history storage and the Gemini key all live in the backend.

## Run it

```bash
pnpm install
pnpm dev
```

Create `.env.local` with:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string, for accounts |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `BACKEND_URL` | Where chatbot-backend runs, e.g. `http://localhost:5000` |
| `BACKEND_JWT_SECRET` | The same secret as in chatbot-backend |

Run chatbot-backend alongside it (see its README).
