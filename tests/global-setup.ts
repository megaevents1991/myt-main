import { request, type FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Runs once before all tests (after the dev servers are up).
 *
 * Logs into the backoffice via its login API and saves the resulting session
 * cookie to tests/.auth/backoffice.json. Backoffice tests then start already
 * authenticated instead of logging in every time.
 *
 * If no credentials are configured in tests/.env, an empty session is written
 * so the config still loads — backoffice authenticated tests skip themselves.
 */
async function globalSetup(config: FullConfig) {
  const storageState = path.resolve(__dirname, ".auth", "backoffice.json");
  fs.mkdirSync(path.dirname(storageState), { recursive: true });

  const email = process.env.BACKOFFICE_EMAIL;
  const password = process.env.BACKOFFICE_PASSWORD;

  // No creds → write an empty session and bail. Authenticated tests will skip.
  if (!email || !password) {
    console.warn(
      "[global-setup] BACKOFFICE_EMAIL/PASSWORD not set in tests/.env — " +
        "backoffice authenticated tests will be skipped."
    );
    fs.writeFileSync(storageState, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const backofficeUrl =
    config.projects.find((p) => p.name === "backoffice")?.use.baseURL ??
    "http://localhost:3001";

  const ctx = await request.newContext({ baseURL: backofficeUrl });
  const res = await ctx.post("/api/auth/login", {
    data: { email, password },
  });

  if (!res.ok()) {
    await ctx.dispose();
    throw new Error(
      `[global-setup] Backoffice login failed (${res.status()}). ` +
        "Check BACKOFFICE_EMAIL/PASSWORD in tests/.env."
    );
  }

  // Persist the `session` cookie set by the login response.
  await ctx.storageState({ path: storageState });
  await ctx.dispose();
  console.log("[global-setup] Backoffice session saved →", storageState);
}

export default globalSetup;
