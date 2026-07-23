import { logger } from "./logger";
import {
  USD_ILS_FALLBACK_RATE,
  TRAVEL_RATE_MULTIPLIER,
} from "./exchangeRate.constants";

interface ExchangeRateData {
  rate: number;
  lastUpdated: Date;
  source: "jsdelivr" | "hardcoded";
}

interface CurrencyRates {
  usdIls: ExchangeRateData;
  eurUsd: ExchangeRateData;
  gbpUsd: ExchangeRateData;
}

type RateKey = keyof CurrencyRates;

const CURRENCY_CONFIG: Record<
  RateKey,
  {
    pair: string;
    base: string;
    target: string;
    min: number;
    max: number;
    fallback: number;
  }
> = {
  usdIls: {
    pair: "USD/ILS",
    base: "usd",
    target: "ils",
    min: 2.7,
    max: 3.65,
    fallback: USD_ILS_FALLBACK_RATE,
  },
  eurUsd: {
    pair: "EUR/USD",
    base: "eur",
    target: "usd",
    min: 1,
    max: 1.7,
    fallback: 1.17,
  },
  gbpUsd: {
    pair: "GBP/USD",
    base: "gbp",
    target: "usd",
    min: 0.8,
    max: 1.8,
    fallback: 1.36,
  },
};

const JSDELIVR_BASE =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";
const CLOUDFLARE_BASE = "https://latest.currency-api.pages.dev/v1/currencies";

const makeHardcoded = (key: RateKey): ExchangeRateData => ({
  rate: CURRENCY_CONFIG[key].fallback,
  lastUpdated: new Date(),
  source: "hardcoded",
});

class ExchangeRateService {
  private currentRates: CurrencyRates = {
    usdIls: makeHardcoded("usdIls"),
    eurUsd: makeHardcoded("eurUsd"),
    gbpUsd: makeHardcoded("gbpUsd"),
  };
  private intervalId: NodeJS.Timeout | null = null;

  private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly CACHE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours

  constructor() {
    setImmediate(() => this.updateAllRates());
    this.startPeriodicUpdates();
  }

  // --- Helpers ---

  private roundUp(rate: number): number {
    return Math.ceil(rate * 100) / 100;
  }

  private validateRate(rate: number, key: RateKey): number | null {
    const rounded = this.roundUp(rate);
    const { min, max } = CURRENCY_CONFIG[key];
    if (rounded >= min && rounded <= max) return rounded;
    logger.warn(
      `Rate ${rounded} for ${key} outside valid range [${min}, ${max}]`,
    );
    return null;
  }

  private isCacheValid(key: RateKey): boolean {
    const cached = this.currentRates[key];
    return (
      cached.source !== "hardcoded" &&
      Date.now() - cached.lastUpdated.getTime() < this.CACHE_MAX_AGE
    );
  }

  private async fetchJson(url: string, timeoutMs = 10_000): Promise<unknown> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : "Unknown error";
  }

  // --- Fetch strategy ---

  private async fetchFromCurrencyApi(key: RateKey): Promise<number | null> {
    const { pair, base, target } = CURRENCY_CONFIG[key];
    const urls = [
      `${JSDELIVR_BASE}/${base}.json`,
      `${CLOUDFLARE_BASE}/${base}.json`,
    ];

    for (const url of urls) {
      try {
        const data = (await this.fetchJson(url)) as Record<
          string,
          Record<string, number>
        >;
        const rawRate = data?.[base]?.[target];
        if (typeof rawRate !== "number")
          throw new Error(`Missing "${target}" in "${base}" entry`);

        const rate = this.validateRate(rawRate, key);
        if (rate !== null) {
          logger.info(`jsDelivr ${pair}: ${rate}`);
          return rate;
        }
        throw new Error("Rate outside valid range");
      } catch (err) {
        logger.warn(
          `Currency API (${url}) ${pair} failed: ${this.errMsg(err)}`,
        );
      }
    }

    logger.error(`Currency API ${pair}: all endpoints failed`);
    return null;
  }

  // --- Update logic ---

  private storeRate(key: RateKey, rate: number): void {
    this.currentRates[key] = {
      rate,
      lastUpdated: new Date(),
      source: "jsdelivr",
    };
    logger.info(`${CURRENCY_CONFIG[key].pair} updated: ${rate} (jsdelivr)`);
  }

  private async updateRate(key: RateKey): Promise<void> {
    const { pair } = CURRENCY_CONFIG[key];

    try {
      const rate = await this.fetchFromCurrencyApi(key);
      if (rate !== null) return this.storeRate(key, rate);

      // Keep cached rate if still valid (< 12h)
      if (this.isCacheValid(key)) {
        const cached = this.currentRates[key];
        const ageMin = Math.round(
          (Date.now() - cached.lastUpdated.getTime()) / 60_000,
        );
        logger.warn(
          `${pair}: using cached rate ${cached.rate} (${ageMin}min old)`,
        );
        return;
      }

      // Hardcoded fallback
      const existing = this.currentRates[key];
      if (existing.source !== "hardcoded") {
        logger.error(
          `${pair}: fetch failed, keeping stale rate ${existing.rate} from ${existing.lastUpdated.toISOString()}`,
        );
      } else {
        logger.error(
          `${pair}: fetch failed, using hardcoded fallback ${existing.rate}`,
        );
        this.currentRates[key] = makeHardcoded(key);
      }
    } catch (err) {
      logger.error(`${pair} update error: ${this.errMsg(err)}`);
    }
  }

  private async updateAllRates(): Promise<void> {
    logger.info("Updating all exchange rates");
    await Promise.allSettled(
      (Object.keys(CURRENCY_CONFIG) as RateKey[]).map((key) =>
        this.updateRate(key),
      ),
    );
    logger.info("Exchange rates update complete");
  }

  private startPeriodicUpdates(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(
      () => this.updateAllRates(),
      this.UPDATE_INTERVAL,
    );
    logger.info(
      `Exchange rate service started (interval: ${this.UPDATE_INTERVAL / 60_000}min, cache TTL: ${this.CACHE_MAX_AGE / 3_600_000}h)`,
    );
  }

  // --- Public API ---

  public getTravelRate(): number {
    // TRAVEL_RATE_MULTIPLIER = margin for travel expenses
    return this.roundUp(this.currentRates.usdIls.rate * TRAVEL_RATE_MULTIPLIER);
  }

  public getUsdIlsRate(): ExchangeRateData {
    return this.currentRates.usdIls;
  }

  public getEurUsdRate(): ExchangeRateData {
    return this.currentRates.eurUsd;
  }

  public getGbpUsdRate(): ExchangeRateData {
    return this.currentRates.gbpUsd;
  }

  public getRateInfo(): ExchangeRateData & { travelRate: number } {
    const usdIls = this.currentRates.usdIls;
    return { ...usdIls, travelRate: this.getTravelRate() };
  }

  public getAllRates(): CurrencyRates & { travelRate: number } {
    return { ...this.currentRates, travelRate: this.getTravelRate() };
  }

  public async forceUpdate(): Promise<void> {
    await this.updateAllRates();
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("Exchange rate service stopped");
    }
  }
}

export const exchangeRateService = new ExchangeRateService();

process.on("SIGTERM", () => exchangeRateService.stop());
process.on("SIGINT", () => exchangeRateService.stop());
