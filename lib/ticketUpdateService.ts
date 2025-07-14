import { supabase } from './supabase';
import { Event } from './app.types';
import { exchangeRateService } from './exchangeRateService';

interface TicketUpdateData {
  id: string;
  price: number;
  available: boolean;
  lastUpdated: Date;
  source: 'api' | 'fallback';
}

interface TicketUpdateResult {
  ticketId: string;
  eventId: number;
  success: boolean;
  updatedPrice?: number;
  available?: boolean;
  error?: string;
}

class TicketUpdateService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly API_BASE_URL = process.env.NEXT_SECRET_XS2EVENT_API_URL || "";
  private readonly API_KEY = process.env.NEXT_SECRET_XS2EVENT_API_KEY;
  private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds
  private currentUpdates: Map<string, TicketUpdateData> = new Map();

  constructor() {
    // Initialize on startup
    this.updateDynamicTickets();
    this.startPeriodicUpdates();
  }

  private roundToNearest9(price: number): number {
    const rounded = Math.ceil(price);
    const lastDigit = rounded % 10;
    
    if (lastDigit <= 9) {
      return rounded - lastDigit + 9;
    }
    return rounded;
  }

  private async fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      console.log("url: ", url);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'X-Api-Key': this.API_KEY || '',
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async fetchTicketDataWithRetry(ticketId: string, retries = this.MAX_RETRIES): Promise<{ price: number; available: boolean } | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Fetching ticket data for ${ticketId} - attempt ${attempt}/${retries}`);
        
        const url = `${this.API_BASE_URL}/tickets/${ticketId}`;
        const response = await this.fetchWithTimeout(url, 10000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Check if we have the expected response structure
        if (data && 
            typeof data.ticket_status === 'string' && 
            typeof data.stock === 'number' &&
            data.local_rates &&
            typeof data.local_rates.net_rate_eur === 'number') {
          
          // Ticket is available if status is "available" and stock > 4
          const available = data.ticket_status === 'available' && data.stock > 4;
          
          // Convert EUR cents to EUR, then to USD using exchange rate
          const priceInEur = data.local_rates.net_rate_eur / 100;
          const eurUsdRate = exchangeRateService.getEurUsdRate();
          const basePrice = priceInEur * eurUsdRate.rate;
          // Add $50 markup to the price and round to nearest 9
          const priceWithMarkup = basePrice + 50;
          const priceInUsd = this.roundToNearest9(priceWithMarkup);
          
          console.log(`Successfully fetched ticket data for ${ticketId}: price=${priceInUsd} USD (${priceInEur} EUR), available=${available}, stock=${data.stock}`);
          
          return {
            price: priceInUsd,
            available: available
          };
        } else {
          throw new Error(`Invalid ticket data structure for ${ticketId} - missing required fields`);
        }
      } catch (error) {
        console.error(`Ticket data fetch attempt ${attempt} failed for ${ticketId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (attempt < retries) {
          console.log(`Retrying in ${this.RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    console.error(`All ${retries} attempts to fetch ticket data for ${ticketId} failed`);
    return null;
  }

  private async getDynamicSportsEvents(): Promise<Event[]> {
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'sports_event_dynamic')
        .is('is_deleted', null)
        .gte('date', new Date().toISOString()) // Only future events
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching dynamic sports events:', error);
        return [];
      }

      return events || [];
    } catch (error) {
      console.error('Error in getDynamicSportsEvents:', error);
      return [];
    }
  }

  private async updateSingleTicket(eventId: number, ticketId: string): Promise<TicketUpdateResult> {
    try {
      const ticketData = await this.fetchTicketDataWithRetry(ticketId);
      
      if (ticketData !== null) {
        // Update the current cache
        this.currentUpdates.set(ticketId, {
          id: ticketId,
          price: ticketData.price,
          available: ticketData.available,
          lastUpdated: new Date(),
          source: 'api'
        });

        // Update the database
        const { error } = await supabase
          .from('events')
          .select('tickets_and_rates')
          .eq('id', eventId)
          .single()
          .then(async ({ data: event, error: selectError }) => {
            if (selectError) throw selectError;
            
            const updatedTickets = event.tickets_and_rates.map((ticket: any) => {
              if (ticket.id === ticketId) {
                return {
                  ...ticket,
                  price: ticketData.price,
                  lastUpdated: new Date().toISOString(),
                  available: ticketData.available,
                  // Add availability status to description if not available
                  description: ticketData.available 
                    ? ticket.description.replace(' - לא זמין', '') 
                    : ticket.description.includes('לא זמין') 
                      ? ticket.description 
                      : ticket.description + ' - לא זמין'
                };
              }
              return ticket;
            });

            return supabase
              .from('events')
              .update({ tickets_and_rates: updatedTickets })
              .eq('id', eventId);
          });

        if (error) {
          throw error;
        }

        console.log(`Successfully updated ticket ${ticketId} for event ${eventId}: price=${ticketData.price}, available=${ticketData.available}`);
        
        return {
          ticketId,
          eventId,
          success: true,
          updatedPrice: ticketData.price,
          available: ticketData.available
        };
      } else {
        console.warn(`Failed to fetch data for ticket ${ticketId}, keeping existing data`);
        return {
          ticketId,
          eventId,
          success: false,
          error: 'Failed to fetch ticket data from API'
        };
      }
    } catch (error) {
      console.error(`Error updating ticket ${ticketId} for event ${eventId}:`, error);
      return {
        ticketId,
        eventId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async updateDynamicTickets(): Promise<void> {
    console.log('Starting dynamic tickets update');
    
    try {
      const dynamicEvents = await this.getDynamicSportsEvents();
      
      if (dynamicEvents.length === 0) {
        console.log('No dynamic sports events found');
        return;
      }

      console.log(`Found ${dynamicEvents.length} dynamic sports events to update`);

      const updatePromises: Promise<TicketUpdateResult>[] = [];

      for (const event of dynamicEvents) {
        if (event.tickets_and_rates && Array.isArray(event.tickets_and_rates)) {
          for (const ticket of event.tickets_and_rates) {
            updatePromises.push(this.updateSingleTicket(event.id, ticket.id));
          }
        }
      }

      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      const failed = results.length - successful;

      console.log(`Dynamic tickets update completed: ${successful} successful, ${failed} failed`);
      
    } catch (error) {
      console.error('Error in updateDynamicTickets:', error);
    }
  }

  private startPeriodicUpdates(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      console.log('Starting scheduled dynamic tickets update');
      this.updateDynamicTickets();
    }, this.UPDATE_INTERVAL);

    console.log(`Dynamic ticket update service started - will update every ${this.UPDATE_INTERVAL / 1000 / 60} minutes`);
  }

  public async forceUpdate(): Promise<TicketUpdateResult[]> {
    console.log('Forcing dynamic tickets update');
    
    const dynamicEvents = await this.getDynamicSportsEvents();
    const updatePromises: Promise<TicketUpdateResult>[] = [];

    for (const event of dynamicEvents) {
      if (event.tickets_and_rates && Array.isArray(event.tickets_and_rates)) {
        for (const ticket of event.tickets_and_rates) {
          updatePromises.push(this.updateSingleTicket(event.id, ticket.id));
        }
      }
    }

    const results = await Promise.allSettled(updatePromises);
    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<TicketUpdateResult>).value);
  }

  public getTicketUpdateData(ticketId: string): TicketUpdateData | undefined {
    return this.currentUpdates.get(ticketId);
  }

  public getAllUpdates(): Map<string, TicketUpdateData> {
    return new Map(this.currentUpdates);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Dynamic ticket update service stopped');
    }
  }
}

// Create a singleton instance
export const ticketUpdateService = new TicketUpdateService();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  ticketUpdateService.stop();
});

process.on('SIGINT', () => {
  ticketUpdateService.stop();
});
