export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle API routes
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

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
