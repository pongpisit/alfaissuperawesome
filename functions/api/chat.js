// functions/api/chat.js

export const config = {
  path: "/api/chat",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  const { prompt } = body;
  if (!prompt) {
    return new Response("Missing `prompt`", { status: 400, headers: CORS_HEADERS });
  }

  try {
    // Call the model via Cloudflare AI Gateway
    const aiResponse = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      { prompt },
      {
        gateway: {
          id: "pongai",
        },
      }
    );

    // Extract text
    const text =
      aiResponse.choices?.[0]?.message?.content ||
      aiResponse.choices?.[0]?.text ||
      aiResponse.response ||
      JSON.stringify(aiResponse);

    // Stream back as plain text
    return new Response(text, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err) {
    return new Response(`AI Error: ${err.message}`, {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
