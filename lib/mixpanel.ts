/* eslint-disable @typescript-eslint/no-explicit-any */
import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "";

export const initMixpanel = () => {
  if (typeof window === "undefined") return;

  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV !== "production",
    track_pageview: true,
    autotrack: true,
    track_links_timeout: 3000,
    record_mask_text_selector: "",
    record_sessions_percent: 100,
  });
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== "undefined") {
    mixpanel.track(eventName, properties);
  }
};

export const identifyUser = (userId: string) => {
  if (typeof window !== "undefined") {
    mixpanel.identify(userId);
  }
};

export const setUserProperties = (properties: Record<string, any>) => {
  if (typeof window !== "undefined") {
    mixpanel.people.set(properties);
  }
};
