export async function onRequestOptions() {
  // Pages Functions are same-origin, so no special CORS needed
  return new Response(null, { status: 204 });
}

export async function onRequestPost({ request, env }) {
  let { prompt } = await request.json();
  if (!prompt) {
    return new Response("Missing prompt", { status: 400 });
  }

  // call your single LLM model
  const aiResponse = await env.AI.run(
    "@cf/meta/llama-3.1-8b-instruct-fast",
    { prompt, stream: true }
  );

  // proxy the streamed body straight back
  return new Response(aiResponse.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
