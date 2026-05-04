import { logger } from "./logger";

interface ExchangeRateData {
  rate: number;
  lastUpdated: Date;
  source: "api" | "fallback";
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
  }
> = {
  usdIls: {
    pair: "USD/ILS",
    floatBase: "usd",
    floatTarget: "ils",
    min: 2.9,
    max: 4.0,
  },
  eurUsd: {
    pair: "EUR/USD",
    floatBase: "eur",
    floatTarget: "usd",
    min: 1,
    max: 1.4,
  },
};

class ExchangeRateService {
  private currentRates: CurrencyRates = {
    usdIls: {
      rate: 3.1, // fallback rate
      lastUpdated: new Date(),
      source: "fallback",
    },
    eurUsd: {
      rate: 1.2, // fallback rate
      lastUpdated: new Date(),
      source: "fallback",
    },
    gbpUsd: {
      rate: 1.35, // fallback rate
      lastUpdated: new Date(),
      source: "fallback",
    },
  };
  private intervalId: NodeJS.Timeout | null = null;
  private readonly API_BASE_URL = "https://api.twelvedata.com/exchange_rate";
  private readonly API_KEY = "43c9bbfbf1cb4a1990c01a1a6d9ddf2f";
  private readonly RATE_LIMITS = {
    usdIls: { min: 2.5, max: 4.0 },
    eurUsd: { min: 1, max: 1.4 },
    gbpUsd: { min: 1.0, max: 1.6 },
  };
  private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly MAX_RETRIES = 4;
  private readonly RETRY_DELAY = 1500; // 1.5s

  constructor() {
    this.updateAllRates();
    this.startPeriodicUpdates();
  }

  private isValidRate(
    rate: number,
    rateKey: "usdIls" | "eurUsd" | "gbpUsd",
  ): boolean {
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
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  }

  private async fetchExchangeRateWithRetry(
    currencyPair: "USD/ILS" | "EUR/USD" | "GBP/USD",
    retries = this.MAX_RETRIES,
  ): Promise<number | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug(
          `Fetching ${currencyPair} exchange rate - attempt ${attempt}/${retries}`,
        );

        const url = `${this.API_BASE_URL}?symbol=${currencyPair}&apikey=${this.API_KEY}`;
        const response = await this.fetchWithTimeout(url, 10000);

        const rate = this.validateRate(data.rate, key);
        if (rate !== null) {
          logger.debug(`TwelveData ${pair}: ${rate} (attempt ${attempt})`);
          return rate;
        }

        const data = await response.json();

        if (data && data.rate && typeof data.rate === "number") {
          const rate = Math.ceil(data.rate * 100) / 100;
          const rateKey =
            currencyPair === "USD/ILS"
              ? "usdIls"
              : currencyPair === "EUR/USD"
                ? "eurUsd"
                : "gbpUsd";

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
    currencyPair: "USD/ILS" | "EUR/USD" | "GBP/USD",
  ): Promise<void> {
    try {
      const rate = await this.fetchExchangeRateWithRetry(currencyPair);
      const rateKey =
        currencyPair === "USD/ILS"
          ? "usdIls"
          : currencyPair === "EUR/USD"
            ? "eurUsd"
            : "gbpUsd";

      if (rate !== null) {
        this.currentRates[rateKey] = {
          rate,
          lastUpdated: new Date(),
          source: "api",
        };
        logger.info(
          `${currencyPair} exchange rate updated successfully: ${rate} (from API)`,
        );
      } else {
        // Keep the existing rate (whether from previous API call or fallback)
        const currentRate = this.currentRates[rateKey];
        logger.warn(
          `Failed to fetch new ${currencyPair} rate after ${this.MAX_RETRIES} attempts. Maintaining previous rate: ${currentRate.rate} (from ${currentRate.source}, last updated: ${currentRate.lastUpdated.toISOString()})`,
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
      this.updateSingleExchangeRate("GBP/USD"),
    ]);

    logger.info("Completed exchange rates update for all currency pairs");
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

      // All sources failed
      const existing = this.currentRates[key];
      logger.error(
        existing
          ? `${pair}: all sources failed, keeping stale rate ${existing.rate} from ${existing.lastUpdated.toISOString()}`
          : `${pair}: all sources failed, no cached rate available`,
      );
    } catch (err) {
      logger.error(`${pair} update error: ${this.errMsg(err)}`);
    }
  }

    this.intervalId = setInterval(() => {
      logger.info("Starting scheduled exchange rate update");
      this.updateAllExchangeRates();
    }, this.UPDATE_INTERVAL);

    logger.info(
      `Exchange rate service started - will update every ${this.UPDATE_INTERVAL / 1000 / 60} minutes`,
    );
  }

  // --- Public API ---

  public getTravelRate(): number | null {
    const usdIls = this.currentRates.usdIls;
    if (!usdIls) return null;
    return this.roundUp(usdIls.rate * 1.015); // +1.5% for travel expenses
  }

  public getUsdIlsRate(): ExchangeRateData | null {
    return this.currentRates.usdIls;
  }

  public getEurUsdRate(): ExchangeRateData | null {
    return this.currentRates.eurUsd;
  }

  public getGbpUsdRate(): ExchangeRateData {
    return this.currentRates.gbpUsd;
  }

  public getRateInfo(): ExchangeRateData & { travelRate: number } {
    return {
      ...this.currentRates.usdIls,
      travelRate: this.getTravelRate(),
    };
  }

  public getAllRates(): CurrencyRates & { travelRate: number } {
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

export const exchangeRateService = new ExchangeRateService();

// Graceful shutdown handler
process.on("SIGTERM", () => {
  exchangeRateService.stop();
});

process.on("SIGINT", () => {
  exchangeRateService.stop();
});
