// ========================================
// Decklister Worker: the deck API (KV) and the site (public/).
//
// A deck collection lives at a secret link, /<id>. Anyone can use a link without
// signing in; one protected with an account (src/accounts) opens only in that
// account's session.
// ========================================

import { createAccounts } from './accounts/index.ts';

const RESERVED = new Set(['api', 'auth', 'share']);

/** Whether a string can be a deck collection's id (the secret part of /<id>). */
function isLinkId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id) && !RESERVED.has(id.toLowerCase());
}

/** The first line of a collection's first deck: its name in the account's list of links. */
async function describeLink(env, id) {
  const raw = await env.DECKLISTEDITOR.get(`user:${id}`);
  if (!raw) return null;
  const decks = JSON.parse(raw);
  const first = Array.isArray(decks) ? decks.find((d) => d && typeof d.text === 'string' && d.text.trim()) : null;
  const title = first ? first.text.trim().split('\n')[0].trim() : '';
  const more = Array.isArray(decks) && decks.length > 1 ? ` (+${decks.length - 1} more)` : '';
  return title ? (title.length > 60 ? title.slice(0, 59) + '…' : title) + more : null;
}

const accountsByEnv = new WeakMap();

function accountsFor(env) {
  let accounts = accountsByEnv.get(env);
  if (!accounts) {
    accounts = createAccounts({
      db: env.DB,
      appOrigin: env.APP_ORIGIN,
      secret: env.BETTER_AUTH_SECRET,
      gauthOrigin: env.GAUTH_ORIGIN,
      gauthCerts: env.GAUTH_CERTS,
      isLinkId,
      linkPath: (id) => `/${id}`,
      describeLink: (id) => describeLink(env, id),
    });
    accountsByEnv.set(env, accounts);
  }
  return accounts;
}

// ========================================
// Security Headers
// ========================================

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function addSecurityHeaders(response) {
  // Redirects (GAuth sign-in) pass through as they are.
  if (response.status >= 300 && response.status < 400) {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
    return new Response(null, { status: response.status, headers });
  }
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}

// ========================================
// Main Worker
// ========================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const response = await handleRequest(request, env, ctx, url);
    return addSecurityHeaders(response);
  },
};

async function handleRequest(request, env, ctx, url) {
    // One address, so sessions (host-only cookies) and GAuth's answers line up.
    if (env.APP_ORIGIN && url.origin !== env.APP_ORIGIN) {
      return Response.redirect(new URL(url.pathname + url.search, env.APP_ORIGIN).toString(), 301);
    }

    const accounts = accountsFor(env);

    // Refuse writes from other sites before anything else runs.
    const refused = accounts.crossOriginPost(request);
    if (refused) return refused;

    // Accounts: /api/auth/*, /api/account, /api/account/links, /auth/gauth, /auth/error
    const accountResponse = await accounts.route(request);
    if (accountResponse) return accountResponse;

    // ========================================
    // Share API Routes
    // ========================================

    if (url.pathname.startsWith('/api/share')) {
      const pathParts = url.pathname.split('/api/share');
      const shareId = pathParts[1]?.replace(/^\//, '');

      // POST /api/share - Create a new share
      if (request.method === 'POST') {
        const { user, deckId } = await request.json().catch(() => ({}));
        if (!isLinkId(user) || typeof deckId !== 'string' || !deckId) {
          return new Response('User and deckId required', { status: 400 });
        }

        // A protected link's decks are shared only by its owner.
        const shareAccess = await accounts.access(request, user);
        if (!shareAccess.ok) return shareAccess.response;

        const uuid = crypto.randomUUID();
        try {
          await env.DECKLISTEDITOR.put(`share:${uuid}`, JSON.stringify({ user, deckId }));
          return new Response(JSON.stringify({ uuid }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (err) {
          return new Response(err.message, { status: 500 });
        }
      }

      // GET /api/share/{uuid} - Retrieve a shared deck
      if (request.method === 'GET') {
        if (!shareId) {
          return new Response('Share ID required', { status: 400 });
        }

        const shareData = await env.DECKLISTEDITOR.get(`share:${shareId}`);
        if (!shareData) {
          return new Response('Share not found', { status: 404 });
        }

        let deckText;
        try {
          const parsed = JSON.parse(shareData);
          if (parsed.user && parsed.deckId) {
            const userData = await env.DECKLISTEDITOR.get(`user:${parsed.user}`);
            if (!userData) {
              return new Response('Shared deck no longer exists', { status: 404 });
            }
            const decks = JSON.parse(userData);
            const deck = decks.find((d) => d.id === parsed.deckId);
            if (!deck) {
              return new Response('Shared deck no longer exists', { status: 404 });
            }
            deckText = deck.text;
          } else {
            deckText = shareData;
          }
        } catch {
          deckText = shareData;
        }

        return new Response(deckText, {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // ========================================
    // User API Routes (with protection)
    // ========================================

    if (url.pathname.startsWith('/api/')) {
      const user = url.pathname.split('/api/')[1];

      if (!user) {
        return new Response('User parameter required', { status: 400 });
      }

      if (!isLinkId(user)) {
        return new Response('Not found', { status: 404 });
      }

      // A protected link opens only in its owner's session (src/accounts).
      const linkAccess = await accounts.access(request, user);
      if (!linkAccess.ok) return linkAccess.response;

      // Handle GET request
      if (request.method === 'GET') {
        let body = await env.DECKLISTEDITOR.get(`user:${user}`);

        if (!body) {
          const oldBody = await env.DECKLISTEDITOR.get(user);

          if (oldBody) {
            const oldData = JSON.parse(oldBody);
            if (oldData.length > 0 && typeof oldData[0] === 'string') {
              const migratedData = oldData.map((text) => ({
                id: crypto.randomUUID(),
                text: text,
              }));
              body = JSON.stringify(migratedData);
            } else {
              body = oldBody;
            }
            await env.DECKLISTEDITOR.put(`user:${user}`, body);
          } else {
            // New user - initialize with a sample deck
            const sampleDeckText = `Sample Deck
#Creatures
4x Lightning Bolt
4x Llanowar Elves
2x Serra Angel
2x Shivan Dragon

#Lands
4x Forest
4x Mountain
4x Plains
4x Island
4x Swamp

#Artifacts
2x Sol Ring
2x Lightning Greaves

#Enchantments
2x Oblivion Ring
2x Rancor

#Spells
4x Counterspell
4x Giant Growth`;
            const sampleDeck = {
              id: crypto.randomUUID(),
              text: sampleDeckText,
            };
            body = JSON.stringify([sampleDeck]);
            await env.DECKLISTEDITOR.put(`user:${user}`, body);
          }
        }

        return new Response(body, {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Link-Protected': linkAccess.owner ? '1' : '0' },
        });
      }

      // Handle PUT request
      if (request.method === 'PUT') {
        const body = await request.text();

        // Validate body is a JSON array of deck objects
        if (body.length > 1_000_000) {
          return new Response(JSON.stringify({ error: 'Payload too large' }), {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        let decks;
        try {
          decks = JSON.parse(body);
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (!Array.isArray(decks) || !decks.every(d =>
          d && typeof d === 'object' && typeof d.id === 'string' && typeof d.text === 'string'
        )) {
          return new Response(JSON.stringify({ error: 'Invalid deck format' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        try {
          const validated = JSON.stringify(decks);
          await env.DECKLISTEDITOR.put(`user:${user}`, validated);
          return new Response(validated, { status: 200 });
        } catch (err) {
          return new Response(err.message, { status: 500 });
        }
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
}
