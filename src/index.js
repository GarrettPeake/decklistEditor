export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle share API routes
    if (url.pathname.startsWith('/api/share')) {
      const pathParts = url.pathname.split('/api/share');
      const shareId = pathParts[1]?.replace(/^\//, ''); // Remove leading slash

      // POST /api/share - Create a new share (receives {user, deckId})
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

      // GET /api/share/{uuid} - Retrieve a shared deck (resolves reference, returns deck text only)
      if (request.method === 'GET') {
        if (!shareId) {
          return new Response('Share ID required', { status: 400 });
        }

        // Get share record
        const shareData = await env.DECKLISTEDITOR.get(`share:${shareId}`);
        if (!shareData) {
          return new Response('Share not found', { status: 404 });
        }

        // Parse share record - handle both old format (plain text) and new format (JSON reference)
        let deckText;
        try {
          const parsed = JSON.parse(shareData);
          if (parsed.user && parsed.deckId) {
            // New format: resolve reference
            const userData = await env.DECKLISTEDITOR.get(`user:${parsed.user}`);
            if (!userData) {
              return new Response('Shared deck no longer exists', { status: 404 });
            }
            const decks = JSON.parse(userData);
            const deck = decks.find(d => d.id === parsed.deckId);
            if (!deck) {
              return new Response('Shared deck no longer exists', { status: 404 });
            }
            deckText = deck.text;
          } else {
            // Old format stored as JSON string somehow, treat as text
            deckText = shareData;
          }
        } catch {
          // Old format: plain deck text
          deckText = shareData;
        }

        return new Response(deckText, {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // Handle user API routes
    if (url.pathname.startsWith('/api/')) {
      const user = url.pathname.split('/api/')[1];

      if (!user) {
        return new Response('User parameter required', { status: 400 });
      }

      // Handle GET request
      if (request.method === 'GET') {
        // Try new format first (user: prefix)
        let body = await env.DECKLISTEDITOR.get(`user:${user}`);

        if (!body) {
          // Check for old format (no prefix)
          const oldBody = await env.DECKLISTEDITOR.get(user);

          if (oldBody) {
            // Migrate old format to new format
            const oldData = JSON.parse(oldBody);

            // Check if it's old format (array of strings) or already migrated (array of objects)
            if (oldData.length > 0 && typeof oldData[0] === 'string') {
              // Old format: array of strings - migrate to array of {id, text}
              const migratedData = oldData.map(text => ({
                id: crypto.randomUUID(),
                text: text
              }));
              body = JSON.stringify(migratedData);
            } else {
              // Already in new format, just needs user: prefix
              body = oldBody;
            }

            // Save with new prefix
            await env.DECKLISTEDITOR.put(`user:${user}`, body);
            // Optionally delete old key (commented out for safety during transition)
            // await env.DECKLISTEDITOR.delete(user);
          } else {
            // New user - initialize with empty array
            body = "[]";
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

    // Serve static assets (including /share/{uuid} and /{user}/{deckId} routes)
    return env.ASSETS.fetch(request);
  },
};
