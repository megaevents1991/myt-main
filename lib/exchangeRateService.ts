import { logger } from "./logger";

interface ExchangeRateData {
  rate: number;
  lastUpdated: Date;
  source: "api" | "fallback";
}

interface CurrencyRates {
  usdIls: ExchangeRateData;
  eurUsd: ExchangeRateData;
}

class ExchangeRateService {
  private currentRates: CurrencyRates = {
    usdIls: {
      rate: 3.5, // fallback rate
      lastUpdated: new Date(),
      source: "fallback",
    },
    eurUsd: {
      rate: 1.2, // fallback rate
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
  };
  private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
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
    try {
      const rate = await this.fetchExchangeRateWithRetry(currencyPair);
      const rateKey = currencyPair === "USD/ILS" ? "usdIls" : "eurUsd";

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
      `Exchange rate service started - will update every ${this.UPDATE_INTERVAL / 1000 / 60} minutes`,
    );
  }

  public getTravelRate(): number {
    const baseRate = this.currentRates.usdIls.rate;
    return Math.ceil(baseRate * 1.015 * 100) / 100; // Adding 1.5% for travel expenses
  }

  public getUsdIlsRate(): ExchangeRateData {
    return this.currentRates.usdIls;
  }

  public getEurUsdRate(): ExchangeRateData {
    return this.currentRates.eurUsd;
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

// Create a singleton instance
export const exchangeRateService = new ExchangeRateService();

// Graceful shutdown handler
process.on("SIGTERM", () => {
  exchangeRateService.stop();
});

process.on("SIGINT", () => {
  exchangeRateService.stop();
});
