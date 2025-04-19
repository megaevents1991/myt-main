"use client";

import { useEffect } from "react";
import { initMixpanel } from "@/lib/mixpanel";
import mixpanel from "mixpanel-browser";

const MixpanelProvider = () => {
  useEffect(() => {
    initMixpanel();
    mixpanel.track_links("a[href]", "linkClicked");
  }, []);

  // Track buttons
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "BUTTON") {
        mixpanel.track("buttonClicked", {
          buttonName: target.innerText,
          buttonTag: target.getAttribute("name") || "",
        });
      }
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
};

export default MixpanelProvider;
