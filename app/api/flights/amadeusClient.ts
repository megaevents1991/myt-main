// Amadeus REST client (Enterprise APIs).
//
// The official `amadeus` npm SDK only supports the (now-deprecated) Self-Service
// APIs and cannot be repointed at an Enterprise gateway. This module is a thin
// fetch-based replacement that mirrors the exact SDK method surface and return
// shapes the rest of the codebase already consumes:
//
//   amadeus.shopping.flightOffersSearch.get(params)
//     -> { data, result, body }   (search route reads `.result.data` + `.result.dictionaries`)
//   amadeus.shopping.flightOffers.pricing.post(body, opts)
//     -> { data, result, body }   (pricing route reads `JSON.parse(response.body)`)
//
// On a non-2xx response it throws an error shaped like the SDK's ResponseError
// (`error.response.result.errors` / `error.response.data.errors`) so the existing
// retry/backoff helper and catch blocks keep working unchanged.
//
// All hosts + credentials come from env so we can validate wiring against the
// Self-Service sandbox (`AMADEUS_ENV=test`) before flipping to the Enterprise
// host (`AMADEUS_ENV=enterprise`). Copy the host / clientId / clientSecret /
// Office ID from the Amadeus Enterprise workspace:
//   https://developers.amadeus.com/my-enterprise-ws/rest

type AmadeusEnv = "test" | "enterprise";

const ENV = (process.env.AMADEUS_ENV as AmadeusEnv) || "test";

// Default hosts per environment. `test` is the Enterprise SANDBOX gateway
// (test.travel.*). `enterprise` is the production gateway (travel.*) — the host
// the production keys authenticate against (verified live 2026-07-18).
// Both can be overridden via AMADEUS_AUTH_HOST / AMADEUS_API_HOST.
const DEFAULT_HOSTS: Record<AmadeusEnv, { auth: string; api: string }> = {
  test: {
    auth: "https://test.travel.api.amadeus.com",
    api: "https://test.travel.api.amadeus.com",
  },
  enterprise: {
    auth: "https://travel.api.amadeus.com",
    api: "https://travel.api.amadeus.com",
  },
};

const AUTH_HOST = process.env.AMADEUS_AUTH_HOST || DEFAULT_HOSTS[ENV].auth;
const API_HOST = process.env.AMADEUS_API_HOST || DEFAULT_HOSTS[ENV].api;
// New Enterprise credentials. Kept under NEW_AMADEUS_* (not the legacy
// AMADEUS_CLIENT_ID/SECRET) so this branch can run in TEST on Vercel alongside
// the existing prod self-service keys, without disturbing them.
const CLIENT_ID = process.env.NEW_AMADEUS_CLIENT_ID as string;
const CLIENT_SECRET = process.env.NEW_AMADEUS_CLIENT_SECRET as string;

// ---------------------------------------------------------------------------
// OAuth2 token manager (client_credentials grant, cached in module scope)
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  const res = await fetch(`${AUTH_HOST}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw buildError(res.status, json);
  }

  // Refresh 60s before the real expiry to avoid edge-of-expiry 401s.
  const ttlMs = ((json.expires_in as number) || 1800) * 1000;
  cachedToken = {
    value: json.access_token as string,
    expiresAt: Date.now() + ttlMs - 60_000,
  };
  return cachedToken.value;
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  // Collapse concurrent refreshes into a single request.
  if (!inFlight) {
    inFlight = fetchToken().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// ---------------------------------------------------------------------------
// Error shaping — match the SDK's ResponseError so callers keep working
// ---------------------------------------------------------------------------

interface AmadeusLikeError extends Error {
  response: {
    statusCode: number;
    result: unknown;
    data: unknown;
  };
}

function buildError(statusCode: number, result: unknown): AmadeusLikeError {
  const err = new Error(`Amadeus API error (${statusCode})`) as AmadeusLikeError;
  err.response = {
    statusCode,
    result,
    // The SDK exposes the parsed body under both `.result` and `.data`;
    // different call sites read different ones, so mirror both.
    data: result,
  };
  return err;
}

// ---------------------------------------------------------------------------
// Core request helper — returns the SDK-style { data, result, body } envelope
// ---------------------------------------------------------------------------

function authHeaders(token: string): Record<string, string> {
  // The office/PCC is bound to the OAuth credential on Amadeus's side, so the
  // bearer token alone carries the right context — no X-Amadeus-Office-Id header
  // is needed (sending one actually trips error 2668 on this gateway).
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function request(
  method: "GET" | "POST",
  path: string,
  {
    query,
    body,
    clientRef,
  }: {
    query?: Record<string, unknown>;
    body?: unknown;
    // Amadeus per-request client reference (header `ama-Client-Ref`). Set by
    // callers so Amadeus support can trace each Search/Price call. Required by
    // the production-certification checklist.
    clientRef?: string;
  } = {}
  // Return shape mirrors the SDK envelope. Typed loose (`any`) so the existing
  // call sites that read `.result.data` / `.result.dictionaries` keep compiling
  // exactly as they did against the SDK's ambient types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any; result: any; body: string }> {
  const token = await getToken();

  let url = `${API_HOST}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(query)) {
      if (val === undefined || val === null) continue;
      qs.append(key, String(val));
    }
    const str = qs.toString();
    if (str) url += `?${str}`;
  }

  const headers = authHeaders(token);
  if (method === "POST") headers["Content-Type"] = "application/json";
  if (clientRef) headers["ama-Client-Ref"] = clientRef;

  const res = await fetch(url, {
    method,
    headers,
    body:
      method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    throw buildError(res.status, json);
  }

  return { data: json.data, result: json, body: text };
}

// ---------------------------------------------------------------------------
// SDK-compatible surface
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SearchParams = Record<string, any>;

export const amadeus = {
  shopping: {
    flightOffersSearch: {
      // GET /v2/shopping/flight-offers
      get: (params: SearchParams, clientRef?: string) =>
        request("GET", "/v2/shopping/flight-offers", {
          query: params,
          clientRef,
        }),
    },
    flightOffers: {
      pricing: {
        // POST /v1/shopping/flight-offers/pricing?include=...
        post: (
          body: unknown,
          opts?: { include?: string[]; clientRef?: string }
        ) =>
          request("POST", "/v1/shopping/flight-offers/pricing", {
            query: opts?.include?.length
              ? { include: opts.include.join(",") }
              : undefined,
            body,
            clientRef: opts?.clientRef,
          }),
      },
    },
  },
};
