// functions/api/chat.js

export const config = {
  path: "/api/chat",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parseAiError(rawErrorMessage) {
  // Strip off the leading "AI Error: " if present
  const jsonPart = rawErrorMessage.replace(/^AI Error:\s*/, "");
  return JSON.parse(jsonPart);
}

export async function onRequest(context) {
  const { request, env } = context;

  // 1) Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // 2) Only POST is allowed
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method Not Allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // 3) Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Invalid JSON" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const { prompt } = body;
  if (!prompt) {
    return new Response(
      JSON.stringify({ success: false, message: "Missing `prompt`" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // 4) Call the model via AI-Gateway
  try {
    const aiResponse = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      { prompt },
      {
        gateway: { id: "pongai" },
      }
    );

    // Extract text from the streaming response
    const text =
      aiResponse.choices?.[0]?.message?.content ||
      aiResponse.choices?.[0]?.text ||
      aiResponse.response ||
      "";

    // 5) Return success JSON
    return new Response(
      JSON.stringify({
        success: true,
        text,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    // 6) Try to parse a guardrail block
    let errorPayload;
    try {
      errorPayload = parseAiError(err.message);
    } catch {
      // fallback if it's not JSON
      return new Response(
        JSON.stringify({ success: false, message: err.message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // If we got a valid payload like
    // { success:false, result:[], messages:[], error:[{code:2016, message:"…"}] }
    const { error: details = [] } = errorPayload;
    return new Response(
      JSON.stringify({
        success: false,
        blocked: true,
        error: details,
      }),
      {
        // 403 = Forbidden / Guardrail block
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
}
