import { logger } from "./logger";

interface ExchangeRateData {
  rate: number;
  lastUpdated: Date;
  source: "api" | "floatrates";
}

interface CurrencyRates {
  usdIls: ExchangeRateData | null;
  eurUsd: ExchangeRateData | null;
}

// FloatRates API response shape
interface FloatRateEntry {
  code: string;
  alphaCode: string;
  rate: number;
  inverseRate: number;
  date: string;
}

class ExchangeRateService {
  private currentRates: CurrencyRates = {
    usdIls: null,
    eurUsd: null,
  };
  private intervalId: NodeJS.Timeout | null = null;
  private readonly API_BASE_URL = "https://api.twelvedata.com/exchange_rate";
  private readonly API_KEY = "43c9bbfbf1cb4a1990c01a1a6d9ddf2f";
  private readonly FLOAT_RATES_BASE_URL = "https://www.floatrates.com/daily";
  private readonly RATE_LIMITS = {
    usdIls: { min: 3.1, max: 4.0 },
    eurUsd: { min: 1, max: 1.4 },
  };
  private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly CACHE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
  private readonly MAX_RETRIES = 4;
  private readonly RETRY_DELAY = 1500; // 1.5 seconds

  constructor() {
    // Initialize on startup
    this.updateAllExchangeRates();
    this.startPeriodicUpdates();
  }

  private isValidRate(rate: number, rateKey: "usdIls" | "eurUsd"): boolean {
    const limits = this.RATE_LIMITS[rateKey];
    return rate >= limits.min && rate <= limits.max;
  }

  private async fetchWithTimeout(
    url: string,
    timeoutMs: number = 10000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private isCacheValid(rateKey: "usdIls" | "eurUsd"): boolean {
    const cached = this.currentRates[rateKey];
    if (!cached) return false;
    const age = Date.now() - cached.lastUpdated.getTime();
    return age < this.CACHE_MAX_AGE;
  }

  /**
   * Fetch rate from FloatRates API (secondary fallback).
   * For USD/ILS: fetches /daily/usd.json → ils.rate
   * For EUR/USD: fetches /daily/eur.json → usd.rate
   */
  private async fetchFromFloatRates(
    currencyPair: "USD/ILS" | "EUR/USD",
  ): Promise<number | null> {
    try {
      const baseCurrency = currencyPair === "USD/ILS" ? "usd" : "eur";
      const targetCurrency = currencyPair === "USD/ILS" ? "ils" : "usd";
      const url = `${this.FLOAT_RATES_BASE_URL}/${baseCurrency}.json`;

      logger.info(
        `Fetching ${currencyPair} from FloatRates fallback API: ${url}`,
      );

      const response = await this.fetchWithTimeout(url, 10000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: Record<string, FloatRateEntry> = await response.json();
      const entry = data[targetCurrency];

      if (!entry || typeof entry.rate !== "number") {
        throw new Error(
          `FloatRates: missing or invalid "${targetCurrency}" entry in response`,
        );
      }

      const rate = Math.ceil(entry.rate * 100) / 100;
      const rateKey = currencyPair === "USD/ILS" ? "usdIls" : "eurUsd";

      if (this.isValidRate(rate, rateKey)) {
        logger.info(
          `Successfully fetched ${currencyPair} from FloatRates: ${rate}`,
        );
        return rate;
      } else {
        throw new Error(
          `FloatRates rate ${rate} for ${currencyPair} is outside valid range (${this.RATE_LIMITS[rateKey].min}-${this.RATE_LIMITS[rateKey].max})`,
        );
      }
    } catch (error) {
      logger.error(
        `FloatRates fallback failed for ${currencyPair}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  private async fetchExchangeRateWithRetry(
    currencyPair: "USD/ILS" | "EUR/USD",
    retries = this.MAX_RETRIES,
  ): Promise<number | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug(
          `Fetching ${currencyPair} exchange rate - attempt ${attempt}/${retries}`,
        );

        const url = `${this.API_BASE_URL}?symbol=${currencyPair}&apikey=${this.API_KEY}`;
        const response = await this.fetchWithTimeout(url, 10000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.rate && typeof data.rate === "number") {
          const rate = Math.ceil(data.rate * 100) / 100;
          const rateKey = currencyPair === "USD/ILS" ? "usdIls" : "eurUsd";

          // Validate the rate is within reasonable limits
          if (this.isValidRate(rate, rateKey)) {
            logger.debug(
              `Successfully fetched ${currencyPair} exchange rate: ${rate}`,
            );
            return rate;
          } else {
            throw new Error(
              `Exchange rate ${rate} for ${currencyPair} is outside valid range (${this.RATE_LIMITS[rateKey].min}-${this.RATE_LIMITS[rateKey].max})`,
            );
          }
        } else {
          throw new Error(
            `Invalid exchange rate data structure for ${currencyPair}`,
          );
        }
      } catch (error) {
        if (attempt === retries) {
          logger.error(
            `Failed to fetch ${currencyPair} exchange rate after ${attempt} attempts:`,
            error instanceof Error ? error.message : "Unknown error",
          );
        } else {
          logger.warn(
            `${currencyPair} exchange rate fetch attempt ${attempt} failed:`,
            error instanceof Error ? error.message : "Unknown error",
          );
        }

        if (attempt < retries) {
          logger.debug(`Retrying in ${this.RETRY_DELAY}ms...`);
          await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    logger.error(
      `All ${retries} attempts to fetch ${currencyPair} exchange rate failed`,
    );
    return null;
  }

  private async updateSingleExchangeRate(
    currencyPair: "USD/ILS" | "EUR/USD",
  ): Promise<void> {
    const rateKey = currencyPair === "USD/ILS" ? "usdIls" : "eurUsd";

    try {
      // Layer 1: Try the primary API (TwelveData)
      const rate = await this.fetchExchangeRateWithRetry(currencyPair);

      if (rate !== null) {
        this.currentRates[rateKey] = {
          rate,
          lastUpdated: new Date(),
          source: "api",
        };
        logger.info(
          `${currencyPair} exchange rate updated successfully: ${rate} (from API)`,
        );
        return;
      }

      // Primary API failed — check if in-process cache is still valid (< 12 hours)
      if (this.isCacheValid(rateKey)) {
        const cached = this.currentRates[rateKey]!;
        const ageMinutes = Math.round(
          (Date.now() - cached.lastUpdated.getTime()) / 60000,
        );
        logger.warn(
          `Primary API failed for ${currencyPair}. Using in-process cached rate: ${cached.rate} (${ageMinutes}min old, from ${cached.source}). Cache valid for up to 12h.`,
        );
        return;
      }

      // Layer 2: Cache is stale or empty — try FloatRates API
      logger.warn(
        `Primary API failed and cache expired/empty for ${currencyPair}. Falling back to FloatRates API.`,
      );
      const floatRate = await this.fetchFromFloatRates(currencyPair);

      if (floatRate !== null) {
        this.currentRates[rateKey] = {
          rate: floatRate,
          lastUpdated: new Date(),
          source: "floatrates",
        };
        logger.info(
          `${currencyPair} exchange rate updated from FloatRates: ${floatRate}`,
        );
        return;
      }

      // Both APIs failed and cache is stale/empty
      const existing = this.currentRates[rateKey];
      if (existing) {
        logger.error(
          `All sources failed for ${currencyPair}. Keeping stale cached rate: ${existing.rate} (from ${existing.source}, last updated: ${existing.lastUpdated.toISOString()})`,
        );
      } else {
        logger.error(
          `All sources failed for ${currencyPair} and no cached rate exists. Rate is unavailable.`,
        );
      }
    } catch (error) {
      logger.error(
        `Unexpected error during ${currencyPair} exchange rate update: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async updateAllExchangeRates(): Promise<void> {
    logger.info("Starting exchange rates update for all currency pairs");

    // Update both currency pairs concurrently
    await Promise.allSettled([
      this.updateSingleExchangeRate("USD/ILS"),
      this.updateSingleExchangeRate("EUR/USD"),
    ]);

    logger.info("Completed exchange rates update for all currency pairs");
  }

  private startPeriodicUpdates(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      logger.info("Starting scheduled exchange rate update");
      this.updateAllExchangeRates();
    }, this.UPDATE_INTERVAL);

    logger.info(
      `Exchange rate service started - will update every ${this.UPDATE_INTERVAL / 1000 / 60} minutes. Cache max age: ${this.CACHE_MAX_AGE / 1000 / 60 / 60}h`,
    );
  }

  public getTravelRate(): number | null {
    const usdIls = this.currentRates.usdIls;
    if (!usdIls) return null;
    return Math.ceil(usdIls.rate * 1.015 * 100) / 100; // Adding 1.5% for travel expenses
  }

  public getUsdIlsRate(): ExchangeRateData | null {
    return this.currentRates.usdIls;
  }

  public getEurUsdRate(): ExchangeRateData | null {
    return this.currentRates.eurUsd;
  }

  public getRateInfo(): (ExchangeRateData & { travelRate: number }) | null {
    const usdIls = this.currentRates.usdIls;
    const travelRate = this.getTravelRate();
    if (!usdIls || travelRate === null) return null;
    return {
      ...usdIls,
      travelRate,
    };
  }

  public getAllRates(): CurrencyRates & { travelRate: number | null } {
    return {
      ...this.currentRates,
      travelRate: this.getTravelRate(),
    };
  }

  public async forceUpdate(): Promise<void> {
    logger.info("Forcing exchange rate update");
    await this.updateAllExchangeRates();
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("Exchange rate service stopped");
    }
  }
}

// Create a singleton instance
export const exchangeRateService = new ExchangeRateService();

// Graceful shutdown handler
process.on("SIGTERM", () => {
  exchangeRateService.stop();
});

process.on("SIGINT", () => {
  exchangeRateService.stop();
});
