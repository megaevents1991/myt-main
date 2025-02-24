"use client";

import { useEffect } from "react";
import { initMixpanel } from "@/lib/mixpanel";

const MixpanelProvider = () => {
  useEffect(() => {
    initMixpanel();
  }, []);

  return null;
};

export default MixpanelProvider;
