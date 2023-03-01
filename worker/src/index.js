/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.js` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.js --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

let env;

export default {
  async fetch(request, e) {
    env = e;
    let res = await handleRequest(request);
    res.headers.set("Access-Control-Allow-headers", "Accept, Accept-Charset, Accept-Language, Authorization, Cache-Control, Content-Language, Content-Type, DNT, Host, If-Modified-Since, Keep-Alive, Origin, Referer, User-Agent, X-Requested-With")
    res.headers.set("Access-Control-Allow-origin", "*")
    res.headers.set("Access-Control-max-age", "86400")
    res.headers.set("Access-Control-Allow-methods", "GET, PUT")
    return res;
  },
};

const defaultData = "[]"

async function getDeckData(request) {
  let key = request.headers.get("authorization")
  let body = await env.DECKLISTEDITOR.get(key)
  if (!body) {
    await env.DECKLISTEDITOR.put(key, defaultData)
    body = defaultData
  }
  return new Response(body, {
    headers: { 'Content-Type': 'text/html' },
  })
}

async function updateDeckData(request) {
  const body = await request.text()
  let key = request.headers.get("authorization")
  try {
    await env.DECKLISTEDITOR.put(key, body)
    return new Response(body, { status: 200 })
  } catch (err) {
    return new Response(err, { status: 500 })
  }
}

async function handleRequest(request) {
  if (request.method === 'PUT') {
    return updateDeckData(request)
  } else {
    return getDeckData(request)
  }
}