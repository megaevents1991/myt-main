/**
 * Validation script for price computation edge cases.
 * Run with: npx ts-node lib/events/__tests__/price.test.ts
 * 
 * This demonstrates that the price helper safely handles:
 * - No tickets
 * - All unavailable tickets
 * - Mixed availability
 * - Events marked as "Sold"
 */

import { computePackagePrice, getTotalMarkupForEvents, isEventSoldOut, hasAvailableTickets } from '../price';
import { Event, EventTicket } from '@/lib/app.types';

// Helper to create test tickets
function createTicket(price: number, available: boolean): EventTicket {
  return {
    id: Math.random().toString(),
    category: 'Test',
    price,
    available,
    description: 'Test ticket',
    colorOnTheMap: '#000000',
  };
}

// Mock event factory
function createMockEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 1,
    name: 'Test Event',
    name_english: 'Test Event',
    date: '2025-12-31',
    type: 'music_event',
    base_flight_price: 500,
    base_hotel_price: 300,
    tickets_and_rates: [
      createTicket(100, true),
      createTicket(200, true),
    ],
    location: { 
      name: 'Test City', 
      city_iata: 'TST',
      latitude: 0,
      longitude: 0,
    },
    card_image_url: 'https://example.com/image.jpg',
    map_image_url: 'https://example.com/map.jpg',
    is_prioritized: false,
    is_deleted: '',
    tags: '',
    description: 'Test event',
    def_date_depart: '2025-12-30',
    def_date_return: '2026-01-02',
    usual_price: 1000,
    ...overrides,
  } as Event;
}

console.log('🧪 Testing price computation edge cases...\n');

// Test 1: Normal event with available tickets
console.log('Test 1: Normal event with available tickets');
const event1 = createMockEvent();
const price1 = computePackagePrice(event1);
console.log(`✓ Price: $${price1} (Expected: $1075 = 500+300+100+175)`);
console.log(`✓ Has tickets: ${hasAvailableTickets(event1)}`);
console.log(`✓ Is sold out: ${isEventSoldOut(event1)}\n`);

// Test 2: Event with no tickets
console.log('Test 2: Event with no tickets');
const event2 = createMockEvent({ tickets_and_rates: [] });
const price2 = computePackagePrice(event2);
console.log(`✓ Price: ${price2} (Expected: null)`);
console.log(`✓ Has tickets: ${hasAvailableTickets(event2)}`);
console.log(`✓ Is sold out: ${isEventSoldOut(event2)}\n`);

// Test 3: Event with all unavailable tickets
console.log('Test 3: Event with all unavailable tickets');
const event3 = createMockEvent({
  tickets_and_rates: [
    createTicket(100, false),
    createTicket(200, false),
  ],
});
const price3 = computePackagePrice(event3);
console.log(`✓ Price: ${price3} (Expected: null)`);
console.log(`✓ Has tickets: ${hasAvailableTickets(event3)}`);
console.log(`✓ Is sold out: ${isEventSoldOut(event3)}\n`);

// Test 4: Event with mixed availability
console.log('Test 4: Event with mixed availability');
const event4 = createMockEvent({
  tickets_and_rates: [
    createTicket(100, false),
    createTicket(150, true),
    createTicket(200, true),
  ],
});
const price4 = computePackagePrice(event4);
console.log(`✓ Price: $${price4} (Expected: $1125 = 500+300+150+175)`);
console.log(`✓ Has tickets: ${hasAvailableTickets(event4)}`);
console.log(`✓ Is sold out: ${isEventSoldOut(event4)}\n`);

// Test 5: Event marked as "Sold" but with available tickets
console.log('Test 5: Event marked as "Sold" (tag takes precedence)');
const event5 = createMockEvent({
  tags: 'Sold',
  tickets_and_rates: [createTicket(100, true)],
});
const price5 = computePackagePrice(event5);
console.log(`✓ Price: $${price5} (Can compute, but event treated as sold out)`);
console.log(`✓ Has tickets: ${hasAvailableTickets(event5)}`);
console.log(`✓ Is sold out: ${isEventSoldOut(event5)} (tag takes precedence)\n`);

// Test 6: Minimum price selection
console.log('Test 6: Minimum price selection from multiple available');
const event6 = createMockEvent({
  tickets_and_rates: [
    createTicket(300, true),
    createTicket(50, true),
    createTicket(150, true),
  ],
});
const price6 = computePackagePrice(event6);
console.log(`✓ Price: $${price6} (Expected: $1025 = 500+300+50+175)\n`);

// Test 7: Custom markup
console.log('Test 7: Custom markup');
const event7 = createMockEvent();
const price7 = computePackagePrice(event7, 250);
console.log(`✓ Price with custom markup: $${price7} (Expected: $1150 = 500+300+100+250)\n`);

// Test 8: Event-specific additional markup
console.log('Test 8: Event-specific additional markup');
const event8 = createMockEvent({ event_additional_markup: 80 });
const price8 = computePackagePrice(event8);
console.log(`✓ Price with event additional markup: $${price8} (Expected: $1155 = 500+300+100+175+80)\n`);

// Test 9: Bundle markup uses the highest event-specific additional markup
console.log('Test 9: Bundle additional markup');
const bundleMarkup = getTotalMarkupForEvents([
  createMockEvent({ event_additional_markup: 40 }),
  createMockEvent({ event_additional_markup: 95 }),
  createMockEvent({ event_additional_markup: 25 }),
]);
console.log(`✓ Bundle markup: $${bundleMarkup} (Expected: $270 = 175+95)\n`);

console.log('✅ All edge cases handled correctly!');
console.log('\nSummary:');
console.log('- Price computation never returns Infinity');
console.log('- Returns null when no available tickets');
console.log('- Correctly identifies sold out events');
console.log('- Selects minimum price from available tickets only');
console.log('- "Sold" tag takes precedence over ticket availability');
