/**
 * AxiomAnare — API Proxy
 * Cloudflare Worker: restless-tree-eac8.kairosventure-io.workers.dev
 * Kairos Ventures Pte Ltd
 *
 * Routes:
 *   POST /v1/messages              → Anthropic Claude API (streaming supported)
 *   POST /embed                    → Voyage AI embeddings  (VOYAGE_API_KEY secret)
 *   POST /rag                      → Supabase match_knowledge_chunks RPC
 *                                    (SUPABASE_URL + SUPABASE_SERVICE_KEY secrets)
 *   POST /create-checkout-session  → Stripe Checkout Session
 *                                    (STRIPE_SECRET_KEY + STRIPE_PRICE_* secrets)
 *   POST /stripe-webhook           → Stripe webhook receiver
 *                                    (STRIPE_WEBHOOK_SECRET secret)
 *
 * Cron Triggers:
 *   Every 3 days at 09:00 UTC     → Supabase keep-alive ping
 *                                   (prevents 7-day inactivity pause on free tier)
 *                                   Schedule configured in Cloudflare Dashboard:
 *                                   Worker - Settings - Triggers - Cron Triggers
 *
 * All API keys injected server-side — never exposed to client.
 *
 * Required Cloudflare env vars (Worker → Settings → Variables → Secrets):
 *   ANTHROPIC_API_KEY
 *   VOYAGE_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_PRO            (Stripe Price ID for AxiomAnare Pro)
 *   STRIPE_PRICE_FLEET_STARTER  (Stripe Price ID for Fleet Starter)
 *   STRIPE_PRICE_FLEET_PRO      (Stripe Price ID for Fleet Pro)
 */

const ALLOWED_ORIGIN     = "https://esimconnect.github.io";
const ANTHROPIC_API_BASE = "https://api.anthropic.com";
const VOYAGE_API_BASE    = "https://api.voyageai.com";
const STRIPE_API_BASE    = "https://api.stripe.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, anthropic-version",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errResponse(msg, status = 500) {
  return jsonResponse({ error: msg }, status);
}

// ── Stripe: map internal tier name → env var price ID ─────────────────────────
function _stripePriceId(tier, env) {
  const map = {
    pro:           env.STRIPE_PRICE_PRO,
    fleet_starter: env.STRIPE_PRICE_FLEET_STARTER,
    fleet_pro:     env.STRIPE_PRICE_FLEET_PRO,
  };
  return map[tier] || null;
}

// ── Stripe: map Stripe Price ID back to internal tier name ────────────────────
function _tierFromPriceId(priceId, env) {
  if (priceId === env.STRIPE_PRICE_PRO)           return "pro";
  if (priceId === env.STRIPE_PRICE_FLEET_STARTER) return "fleet_starter";
  if (priceId === env.STRIPE_PRICE_FLEET_PRO)     return "fleet_pro";
  return null;
}

// ── Stripe webhook: verify signature using HMAC-SHA256 ───────────────────────
// Cloudflare Workers have SubtleCrypto available via globalThis.crypto
async function _verifyStripeSignature(payload, sigHeader, secret) {
  // sigHeader format: t=<timestamp>,v1=<sig1>,v1=<sig2>,...
  const parts     = sigHeader.split(",");
  const tPart     = parts.find(p => p.startsWith("t="));
  const v1Parts   = parts.filter(p => p.startsWith("v1="));
  if (!tPart || !v1Parts.length) return false;

  const timestamp  = tPart.slice(2);
  const signedPayload = `${timestamp}.${payload}`;

  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return v1Parts.some(p => p.slice(3) === sigHex);
}

export default {
  async fetch(request, env) {

    // ── Preflight ─────────────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Stripe webhook: no Origin check (called by Stripe servers, not browser)
    const url      = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/stripe-webhook") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const rawBody   = await request.text();
      const sigHeader = request.headers.get("stripe-signature") || "";

      if (!env.STRIPE_WEBHOOK_SECRET) {
        console.error("STRIPE_WEBHOOK_SECRET not configured");
        return new Response("Webhook secret not configured", { status: 500 });
      }

      const valid = await _verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
      if (!valid) {
        console.error("Stripe webhook signature verification failed");
        return new Response("Invalid signature", { status: 400 });
      }

      let event;
      try { event = JSON.parse(rawBody); } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      // ── Handle checkout.session.completed ───────────────────────────────────
      if (event.type === "checkout.session.completed") {
        const session       = event.data.object;
        const userId        = session.client_reference_id;   // Supabase user UUID
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error("Webhook: no client_reference_id on session", session.id);
          return new Response("OK", { status: 200 }); // ACK to Stripe regardless
        }

        // Fetch the subscription to get the Price ID
        let newTier = null;
        if (subscriptionId && env.STRIPE_SECRET_KEY) {
          try {
            const subRes = await fetch(`${STRIPE_API_BASE}/v1/subscriptions/${subscriptionId}`, {
              headers: { "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}` },
            });
            if (subRes.ok) {
              const subData = await subRes.json();
              const priceId = subData?.items?.data?.[0]?.price?.id;
              newTier = _tierFromPriceId(priceId, env);
            }
          } catch (err) {
            console.error("Webhook: failed to fetch subscription:", err.message);
          }
        }

        // Fall back: check metadata.tier set during checkout session creation
        if (!newTier && session.metadata?.tier) {
          newTier = session.metadata.tier;
        }

        if (!newTier) {
          console.error("Webhook: could not resolve tier for session", session.id);
          return new Response("OK", { status: 200 });
        }

        const supabaseUrl = env.SUPABASE_URL;
        const serviceKey  = env.SUPABASE_SERVICE_KEY;

        // Update profiles.tier
        try {
          const profileRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":  "application/json",
                "apikey":        serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
                "Prefer":        "return=minimal",
              },
              body: JSON.stringify({
                tier:            newTier,
                stripe_customer_id:    session.customer      || null,
                stripe_subscription_id: subscriptionId       || null,
                updated_at:      new Date().toISOString(),
              }),
            }
          );
          if (!profileRes.ok) {
            const detail = await profileRes.text();
            console.error("Webhook: profile update failed:", detail);
          }
        } catch (err) {
          console.error("Webhook: profile PATCH error:", err.message);
        }

        // Insert subscription_events audit row
        try {
          await fetch(
            `${supabaseUrl}/rest/v1/subscription_events`,
            {
              method: "POST",
              headers: {
                "Content-Type":  "application/json",
                "apikey":        serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
                "Prefer":        "return=minimal",
              },
              body: JSON.stringify({
                user_id:          userId,
                event_type:       event.type,
                tier:             newTier,
                stripe_event_id:  event.id,
                stripe_customer_id:    session.customer      || null,
                stripe_subscription_id: subscriptionId       || null,
                raw_payload:      event,
                created_at:       new Date().toISOString(),
              }),
            }
          );
        } catch (err) {
          console.error("Webhook: subscription_events insert error:", err.message);
          // Non-fatal — profile already updated above
        }
      }

      // ── Handle customer.subscription.deleted (cancellation / lapse) ─────────
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const customerId   = subscription.customer;
        const supabaseUrl  = env.SUPABASE_URL;
        const serviceKey   = env.SUPABASE_SERVICE_KEY;

        // Look up user by stripe_customer_id and downgrade to free
        try {
          const profileRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":  "application/json",
                "apikey":        serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
                "Prefer":        "return=minimal",
              },
              body: JSON.stringify({
                tier:       "free",
                stripe_subscription_id: null,
                updated_at: new Date().toISOString(),
              }),
            }
          );
          if (!profileRes.ok) {
            const detail = await profileRes.text();
            console.error("Webhook: subscription.deleted profile update failed:", detail);
          }
        } catch (err) {
          console.error("Webhook: subscription.deleted PATCH error:", err.message);
        }

        // Audit log
        try {
          await fetch(`${supabaseUrl}/rest/v1/subscription_events`, {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "apikey":        serviceKey,
              "Authorization": `Bearer ${serviceKey}`,
              "Prefer":        "return=minimal",
            },
            body: JSON.stringify({
              event_type:       event.type,
              stripe_event_id:  event.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              raw_payload:      event,
              created_at:       new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error("Webhook: subscription.deleted audit insert error:", err.message);
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ── Origin guard (all other routes) ──────────────────────────────────────
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ROUTE: /create-checkout-session  — Stripe Checkout
    // Body: { tier: string, userId: string, email: string, returnUrl: string }
    // Returns: { url: string }  — redirect client to this URL
    // ══════════════════════════════════════════════════════════════════════════
    if (pathname === "/create-checkout-session") {
      let body;
      try { body = await request.json(); } catch {
        return errResponse("Invalid JSON body", 400);
      }

      const { tier, userId, email, returnUrl } = body;

      if (!tier || !userId || !email) {
        return errResponse("tier, userId and email are required", 400);
      }

      const priceId = _stripePriceId(tier, env);
      if (!priceId) {
        return errResponse(`No Stripe Price ID configured for tier: ${tier}`, 400);
      }

      if (!env.STRIPE_SECRET_KEY) {
        return errResponse("Stripe not configured", 500);
      }

      // The page the user was on — used for success/cancel redirect
      const base      = "https://esimconnect.github.io/AxiomAnare";
      const returnPath = returnUrl || base + "/";
      const successUrl = returnPath + (returnPath.includes("?") ? "&" : "?") + "payment=success";
      const cancelUrl  = returnPath + (returnPath.includes("?") ? "&" : "?") + "payment=cancelled";

      // Build Stripe Checkout Session
      const params = new URLSearchParams({
        mode:                        "subscription",
        "line_items[0][price]":      priceId,
        "line_items[0][quantity]":   "1",
        customer_email:              email,
        client_reference_id:         userId,          // links payment → Supabase user
        success_url:                 successUrl,
        cancel_url:                  cancelUrl,
        "metadata[tier]":            tier,            // fallback tier resolution in webhook
        "subscription_data[metadata][user_id]": userId,
        "subscription_data[metadata][tier]":    tier,
      });

      let stripeRes;
      try {
        stripeRes = await fetch(`${STRIPE_API_BASE}/v1/checkout/sessions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type":  "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
      } catch (err) {
        return errResponse("Stripe fetch failed: " + err.message, 502);
      }

      const stripeData = await stripeRes.json();

      if (!stripeRes.ok) {
        const msg = stripeData?.error?.message || "Stripe error";
        console.error("Stripe checkout session error:", msg);
        return errResponse(msg, stripeRes.status);
      }

      return jsonResponse({ url: stripeData.url });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ROUTE: /embed  — Voyage AI text embedding
    // Body: { text: string }
    // Returns: { embedding: number[1024] }
    // ══════════════════════════════════════════════════════════════════════════
    if (pathname === "/embed") {
      let body;
      try { body = await request.json(); } catch {
        return errResponse("Invalid JSON body", 400);
      }
      const text = (body.text || "").trim();
      if (!text) return errResponse("text field required", 400);

      let voyageRes;
      try {
        voyageRes = await fetch(`${VOYAGE_API_BASE}/v1/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.VOYAGE_API_KEY}`,
          },
          body: JSON.stringify({ model: "voyage-3", input: [text] }),
        });
      } catch (err) {
        return errResponse("Voyage fetch failed: " + err.message, 502);
      }

      if (!voyageRes.ok) {
        const detail = await voyageRes.text();
        return errResponse("Voyage API error: " + detail, voyageRes.status);
      }

      const vData = await voyageRes.json();
      const embedding = vData?.data?.[0]?.embedding;
      if (!embedding) return errResponse("No embedding returned from Voyage", 502);

      return jsonResponse({ embedding });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ROUTE: /rag  — Supabase match_knowledge_chunks RPC
    // Body: { query_embedding: number[1024], match_count?: number }
    // Returns: chunk[]  (array of knowledge chunk rows with similarity)
    // Uses service key — bypasses RLS so all chunks are searchable
    // ══════════════════════════════════════════════════════════════════════════
    if (pathname === "/rag") {
      let body;
      try { body = await request.json(); } catch {
        return errResponse("Invalid JSON body", 400);
      }
      if (!body.query_embedding || !Array.isArray(body.query_embedding)) {
        return errResponse("query_embedding array required", 400);
      }

      const supabaseUrl = env.SUPABASE_URL;
      const serviceKey  = env.SUPABASE_SERVICE_KEY;
      if (!supabaseUrl || !serviceKey) {
        return errResponse("Supabase env vars not configured", 500);
      }

      let rpcRes;
      try {
        rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/match_knowledge_chunks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey":        serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            query_embedding: body.query_embedding,
            match_count:     body.match_count || 5,
          }),
        });
      } catch (err) {
        return errResponse("Supabase fetch failed: " + err.message, 502);
      }

      if (!rpcRes.ok) {
        const detail = await rpcRes.text();
        return errResponse("Supabase RPC error: " + detail, rpcRes.status);
      }

      const chunks = await rpcRes.json();
      return jsonResponse(chunks);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ROUTE: /v1/messages (and any /v1/* path)  — Anthropic Claude API
    // Pass-through proxy with API key injection. Supports SSE streaming.
    // ══════════════════════════════════════════════════════════════════════════
    const upstreamURL = ANTHROPIC_API_BASE + pathname;

    const upstreamHeaders = new Headers();
    upstreamHeaders.set("Content-Type", "application/json");
    upstreamHeaders.set("x-api-key", env.ANTHROPIC_API_KEY);
    upstreamHeaders.set(
      "anthropic-version",
      request.headers.get("anthropic-version") || "2023-06-01"
    );

    const body = await request.text();

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstreamURL, {
        method: "POST",
        headers: upstreamHeaders,
        body,
      });
    } catch (err) {
      return errResponse("Upstream fetch failed: " + err.message, 502);
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(k, v);
    }

    // SSE streaming passthrough
    const contentType = upstreamResponse.headers.get("Content-Type") || "";
    if (contentType.includes("text/event-stream")) {
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    const responseBody = await upstreamResponse.text();
    return new Response(responseBody, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CRON: Supabase keep-alive — prevents 7-day inactivity pause on free tier
  // Triggered by Cloudflare Cron Trigger: "0 9 */3 * *" (every 3 days, 09:00 UTC)
  // Query: GET /rest/v1/assets?select=id&limit=1
  // Logs to Worker console — visible in CF dashboard → Logs tab
  // ══════════════════════════════════════════════════════════════════════════
  async scheduled(event, env, ctx) {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey  = env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("keepalive: Supabase env vars not configured");
      return;
    }
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/assets?select=id&limit=1`,
        {
          headers: {
            "apikey":        serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          },
        }
      );
      console.log(`keepalive ${res.status} @ ${new Date().toISOString()}`);
    } catch (err) {
      console.error("keepalive failed:", err.message);
    }
  },
};
