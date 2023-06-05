const defaultData = "[]"

export async function onRequestGet(context) {
  const key = context.params.user
  let body = await context.env.DECKLISTEDITOR.get(key)
  if (!body) {
    await context.env.DECKLISTEDITOR.put(key, "[]")
    body = "[]"
  }
  return new Response(body, {
    headers: { 'Content-Type': 'text/html' },
  })
}

export async function onRequestPut(context) {
  const key = context.params.user
  const body = await context.request.text()
  try {
    await context.env.DECKLISTEDITOR.put(key, body)
    return new Response(body, { status: 200 })
  } catch (err) {
    return new Response(err, { status: 500 })
  }
}