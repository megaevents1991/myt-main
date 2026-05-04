import { logger } from "./logger";

interface ExchangeRateData {
  rate: number;
  lastUpdated: Date;
  source: "api" | "floatrates" | "jsdelivr" | "hardcoded";
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
    floatBase: string;
    floatTarget: string;
    min: number;
    max: number;
    fallback: number;
  }
> = {
  usdIls: {
    pair: "USD/ILS",
    floatBase: "usd",
    floatTarget: "ils",
    min: 2.7,
    max: 3.65,
    fallback: 3.05,
  },
  eurUsd: {
    pair: "EUR/USD",
    floatBase: "eur",
    floatTarget: "usd",
    min: 1,
    max: 1.4,
    fallback: 1.09,
  },
  gbpUsd: {
    pair: "GBP/USD",
    floatBase: "gbp",
    floatTarget: "usd",
    min: 0.8,
    max: 1.6,
    fallback: 1.27,
  },
};

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

  private readonly TWELVE_DATA_URL = "https://api.twelvedata.com/exchange_rate";
  private readonly TWELVE_DATA_KEY = "43c9bbfbf1cb4a1990c01a1a6d9ddf2f";
  private readonly FLOAT_RATES_URL = "https://www.floatrates.com/daily";
  private readonly JSDELIVR_URL =
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";
  private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly CACHE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours
  private readonly MAX_RETRIES = 4;
  private readonly RETRY_DELAY = 1500; // 1.5s

  constructor() {
    this.updateAllRates();
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

  // --- Fetch strategies ---

  private async fetchFromTwelveData(key: RateKey): Promise<number | null> {
    const { pair } = CURRENCY_CONFIG[key];
    const url = `${this.TWELVE_DATA_URL}?symbol=${pair}&apikey=${this.TWELVE_DATA_KEY}`;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const data = (await this.fetchJson(url)) as { rate?: number };
        if (typeof data?.rate !== "number")
          throw new Error("Invalid response structure");

        const rate = this.validateRate(data.rate, key);
        if (rate !== null) {
          logger.debug(`TwelveData ${pair}: ${rate} (attempt ${attempt})`);
          return rate;
        }
        throw new Error("Rate outside valid range");
      } catch (err) {
        if (attempt === this.MAX_RETRIES) {
          logger.error(
            `TwelveData ${pair} failed after ${attempt} attempts: ${this.errMsg(err)}`,
          );
        } else {
          logger.warn(
            `TwelveData ${pair} attempt ${attempt} failed: ${this.errMsg(err)}`,
          );
          await new Promise((r) => setTimeout(r, this.RETRY_DELAY));
        }
      }
    }
    return null;
  }

  private async fetchFromFloatRates(key: RateKey): Promise<number | null> {
    const { pair, floatBase, floatTarget } = CURRENCY_CONFIG[key];
    const url = `${this.FLOAT_RATES_URL}/${floatBase}.json`;

    try {
      const data = (await this.fetchJson(url)) as Record<
        string,
        { rate?: number }
      >;
      const rawRate = data?.[floatTarget]?.rate;
      if (typeof rawRate !== "number")
        throw new Error(`Missing "${floatTarget}" entry`);

      const rate = this.validateRate(rawRate, key);
      if (rate !== null) {
        logger.info(`FloatRates ${pair}: ${rate}`);
        return rate;
      }
      throw new Error("Rate outside valid range");
    } catch (err) {
      logger.error(`FloatRates ${pair} failed: ${this.errMsg(err)}`);
      return null;
    }
  }

  private async fetchFromJsdelivr(key: RateKey): Promise<number | null> {
    const { pair, floatBase, floatTarget } = CURRENCY_CONFIG[key];
    const url = `${this.JSDELIVR_URL}/${floatBase}.json`;

    try {
      const data = (await this.fetchJson(url)) as Record<
        string,
        Record<string, number>
      >;
      const rawRate = data?.[floatBase]?.[floatTarget];
      if (typeof rawRate !== "number")
        throw new Error(`Missing "${floatTarget}" in "${floatBase}" entry`);

      const rate = this.validateRate(rawRate, key);
      if (rate !== null) {
        logger.info(`jsDelivr ${pair}: ${rate}`);
        return rate;
      }
      throw new Error("Rate outside valid range");
    } catch (err) {
      logger.error(`jsDelivr ${pair} failed: ${this.errMsg(err)}`);
      return null;
    }
  }

  // --- Update logic ---

  private storeRate(
    key: RateKey,
    rate: number,
    source: ExchangeRateData["source"],
  ): void {
    this.currentRates[key] = { rate, lastUpdated: new Date(), source };
    logger.info(`${CURRENCY_CONFIG[key].pair} updated: ${rate} (${source})`);
  }

  private async updateRate(key: RateKey): Promise<void> {
    const { pair } = CURRENCY_CONFIG[key];

    try {
      // Layer 1: Primary API (TwelveData)
      const apiRate = await this.fetchFromTwelveData(key);
      if (apiRate !== null) return this.storeRate(key, apiRate, "api");

      // Use cached rate if still valid (< 12h)
      if (this.isCacheValid(key)) {
        const cached = this.currentRates[key]!;
        const ageMin = Math.round(
          (Date.now() - cached.lastUpdated.getTime()) / 60_000,
        );
        logger.warn(
          `${pair}: API failed, using cached rate ${cached.rate} (${cached.source}, ${ageMin}min old)`,
        );
        return;
      }

      // Layer 2: FloatRates fallback
      const floatRate = await this.fetchFromFloatRates(key);
      if (floatRate !== null)
        return this.storeRate(key, floatRate, "floatrates");

      // Layer 3: jsDelivr (fawazahmed0) daily fallback
      const jsdelivrRate = await this.fetchFromJsdelivr(key);
      if (jsdelivrRate !== null)
        return this.storeRate(key, jsdelivrRate, "jsdelivr");

      // Layer 4: Hardcoded fallback — rate is never null
      const existing = this.currentRates[key];
      if (existing.source !== "hardcoded") {
        logger.error(
          `${pair}: all sources failed, keeping stale rate ${existing.rate} from ${existing.lastUpdated.toISOString()}`,
        );
      } else {
        logger.error(
          `${pair}: all sources failed, using hardcoded fallback rate ${existing.rate}`,
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
    return this.roundUp(this.currentRates.usdIls.rate * 1.015); // +1.5% for travel expenses
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
