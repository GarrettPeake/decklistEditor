export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle share API routes
    if (url.pathname.startsWith('/api/share')) {
      const pathParts = url.pathname.split('/api/share');
      const shareId = pathParts[1]?.replace(/^\//, ''); // Remove leading slash

      // POST /api/share - Create a new share
      if (request.method === 'POST') {
        const deckText = await request.text();
        const uuid = crypto.randomUUID();
        try {
          await env.DECKLISTEDITOR.put(`share:${uuid}`, deckText);
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
        const deckText = await env.DECKLISTEDITOR.get(`share:${shareId}`);
        if (!deckText) {
          return new Response('Share not found', { status: 404 });
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
        let body = await env.DECKLISTEDITOR.get(user);
        if (!body) {
          await env.DECKLISTEDITOR.put(user, "[]");
          body = "[]";
        }
        return new Response(body, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Handle PUT request
      if (request.method === 'PUT') {
        const body = await request.text();
        try {
          await env.DECKLISTEDITOR.put(user, body);
          return new Response(body, { status: 200 });
        } catch (err) {
          return new Response(err.message, { status: 500 });
        }
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // Serve static assets (including /share/{uuid} routes)
    return env.ASSETS.fetch(request);
  },
};
