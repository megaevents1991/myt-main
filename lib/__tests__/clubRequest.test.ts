import { describe, expect, it } from "vitest";
import { isOwnSiteJsonPost } from "@/lib/club/request";

const req = (headers: Record<string, string>) =>
  new Request("https://www.mega-events.co.il/api/club/join", { method: "POST", headers: { host: "www.mega-events.co.il", ...headers } });

describe("isOwnSiteJsonPost (a join or lookup comes from our own page)", () => {
  it("accepts our own page's fetch", () =>
    expect(
      isOwnSiteJsonPost(
        req({ "content-type": "application/json", origin: "https://www.mega-events.co.il", "sec-fetch-site": "same-origin" }),
      ),
    ).toBe(true));
  it("accepts a JSON post with no browser headers (server to server, curl)", () =>
    expect(isOwnSiteJsonPost(req({ "content-type": "application/json" }))).toBe(true));
  it("refuses a body that is not JSON (a no-cors post from another site skips the preflight)", () => {
    expect(isOwnSiteJsonPost(req({ "content-type": "text/plain;charset=UTF-8" }))).toBe(false);
    expect(isOwnSiteJsonPost(req({}))).toBe(false);
  });
  it("refuses another site", () => {
    expect(isOwnSiteJsonPost(req({ "content-type": "application/json", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isOwnSiteJsonPost(req({ "content-type": "application/json", origin: "https://evil.example" }))).toBe(false);
  });
  it("reads the forwarded host behind the platform's proxy", () =>
    expect(
      isOwnSiteJsonPost(
        req({ "content-type": "application/json", origin: "https://club-preview.vercel.app", "x-forwarded-host": "club-preview.vercel.app" }),
      ),
    ).toBe(true));
});
