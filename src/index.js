// ========================================
// Password Hashing Utilities (PBKDF2)
// ========================================

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
}

async function verifyPassword(password, salt, storedHash) {
  const hash = await hashPassword(password, salt);
  // Constant-time comparison to prevent timing attacks
  if (hash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

// ========================================
// JWT Utilities
// ========================================

async function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };

  const encoder = new TextEncoder();

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${data}.${signatureB64}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature
    const signaturePadded = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureStr = atob(signaturePadded);
    const signature = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) {
      signature[i] = signatureStr.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    if (!valid) return null;

    // Decode payload
    const payloadPadded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadPadded));

    // Check expiry
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ========================================
// Auth Helper Functions
// ========================================

function getJWTSecret(env) {
  // Use environment secret, fall back to a default for development
  return env.JWT_SECRET || 'decklister-dev-secret-change-in-production';
}

async function extractAndVerifyToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  return await verifyJWT(token, getJWTSecret(env));
}

async function isUUIDProtected(uuid, env) {
  // Check if this UUID has an associated account
  const accountUsername = await env.DECKLISTEDITOR.get(`uuid-account:${uuid}`);
  return accountUsername !== null;
}

// ========================================
// Main Worker
// ========================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ========================================
    // Auth API Routes
    // ========================================

    // POST /api/auth/register - Create account, link to UUID
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      try {
        const { username, password, uuid } = await request.json();

        if (!username || !password || !uuid) {
          return new Response(JSON.stringify({ error: 'Username, password, and UUID required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Validate username (alphanumeric, 3-30 chars)
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
          return new Response(JSON.stringify({ error: 'Username must be 3-30 alphanumeric characters or underscores' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check if username already exists
        const existingAccount = await env.DECKLISTEDITOR.get(`account:${username.toLowerCase()}`);
        if (existingAccount) {
          return new Response(JSON.stringify({ error: 'Username already taken' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check if UUID is already protected
        const existingProtection = await env.DECKLISTEDITOR.get(`uuid-account:${uuid}`);
        if (existingProtection) {
          return new Response(JSON.stringify({ error: 'This decklist is already protected by an account' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Generate salt and hash password
        const salt = crypto.randomUUID();
        const passwordHash = await hashPassword(password, salt);

        // Create account
        const account = {
          uuid,
          passwordHash,
          salt,
          createdAt: Date.now(),
        };

        // Store account and reverse lookup
        await env.DECKLISTEDITOR.put(`account:${username.toLowerCase()}`, JSON.stringify(account));
        await env.DECKLISTEDITOR.put(`uuid-account:${uuid}`, username.toLowerCase());

        // Generate JWT
        const token = await createJWT(
          {
            sub: uuid,
            username: username.toLowerCase(),
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          },
          getJWTSecret(env)
        );

        return new Response(JSON.stringify({ token, username: username.toLowerCase() }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Registration failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // POST /api/auth/login - Authenticate, return JWT
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const { username, password } = await request.json();

        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Username and password required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Get account
        const accountData = await env.DECKLISTEDITOR.get(`account:${username.toLowerCase()}`);

        // Always hash to prevent timing attacks (even if user doesn't exist)
        const dummySalt = 'dummy-salt-for-timing';
        if (!accountData) {
          await hashPassword(password, dummySalt);
          return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const account = JSON.parse(accountData);

        // Verify password
        const valid = await verifyPassword(password, account.salt, account.passwordHash);
        if (!valid) {
          return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Generate JWT
        const token = await createJWT(
          {
            sub: account.uuid,
            username: username.toLowerCase(),
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          },
          getJWTSecret(env)
        );

        return new Response(JSON.stringify({ token, uuid: account.uuid, username: username.toLowerCase() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Login failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ========================================
    // Share API Routes (unchanged)
    // ========================================

    if (url.pathname.startsWith('/api/share')) {
      const pathParts = url.pathname.split('/api/share');
      const shareId = pathParts[1]?.replace(/^\//, '');

      // POST /api/share - Create a new share
      if (request.method === 'POST') {
        const { user, deckId } = await request.json();
        if (!user || !deckId) {
          return new Response('User and deckId required', { status: 400 });
        }
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

      // Check if this UUID is protected
      const isProtected = await isUUIDProtected(user, env);

      if (isProtected) {
        // Verify JWT
        const payload = await extractAndVerifyToken(request, env);
        if (!payload || payload.sub !== user) {
          return new Response(JSON.stringify({ error: 'Authentication required', protected: true }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

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
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle PUT request
      if (request.method === 'PUT') {
        const body = await request.text();
        try {
          await env.DECKLISTEDITOR.put(`user:${user}`, body);
          return new Response(body, { status: 200 });
        } catch (err) {
          return new Response(err.message, { status: 500 });
        }
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
