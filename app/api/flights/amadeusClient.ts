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

// Default hosts per environment. `test` is the public sandbox; `enterprise`
// hosts should be supplied via env from the Enterprise workspace (the fallback
// below is only a placeholder so the module loads before the pack is wired).
const DEFAULT_HOSTS: Record<AmadeusEnv, { auth: string; api: string }> = {
  test: {
    auth: "https://test.api.amadeus.com",
    api: "https://test.api.amadeus.com",
  },
  enterprise: {
    auth: "https://api.amadeus.com",
    api: "https://api.amadeus.com",
  },
};

const AUTH_HOST = process.env.AMADEUS_AUTH_HOST || DEFAULT_HOSTS[ENV].auth;
const API_HOST = process.env.AMADEUS_API_HOST || DEFAULT_HOSTS[ENV].api;
const CLIENT_ID = process.env.AMADEUS_CLIENT_ID as string;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET as string;
const OFFICE_ID = process.env.AMADEUS_OFFICE_ID; // optional, Enterprise only

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
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (OFFICE_ID && ENV === "enterprise") {
    // Office ID is Enterprise-only. Sending it to the test/self-service host
    // triggers Amadeus error 2668 (officeId not allowed).
    headers["X-Amadeus-Office-Id"] = OFFICE_ID;
  }
  return headers;
}

async function request(
  method: "GET" | "POST",
  path: string,
  { query, body }: { query?: Record<string, unknown>; body?: unknown } = {}
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
      get: (params: SearchParams) =>
        request("GET", "/v2/shopping/flight-offers", { query: params }),
      // POST /v2/shopping/flight-offers — richer body; lets us set
      // searchCriteria.additionalInformation.brandedFares=false, which the GET
      // endpoint can't express. Needed on the Enterprise gateway where the
      // branded-fares default + officeId combo triggers error 2668.
      post: (body: unknown) =>
        request("POST", "/v2/shopping/flight-offers", { body }),
    },
    flightOffers: {
      pricing: {
        // POST /v1/shopping/flight-offers/pricing?include=...
        post: (body: unknown, opts?: { include?: string[] }) =>
          request("POST", "/v1/shopping/flight-offers/pricing", {
            query: opts?.include?.length
              ? { include: opts.include.join(",") }
              : undefined,
            body,
          }),
      },
    },
  },
};
