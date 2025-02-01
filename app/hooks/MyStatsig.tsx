"use client";

import React from "react";
import { StatsigProvider } from "@statsig/react-bindings";
import { StatsigAutoCapturePlugin } from "@statsig/web-analytics";
import { StatsigSessionReplayPlugin } from "@statsig/session-replay";

export default function MyStatsig({ children }: { children: React.ReactNode }) {
  return (
    <StatsigProvider
      sdkKey={process.env.NEXT_PUBLIC_STATSIG_ENV_KEY || ""}
      user={{ userID: "a-user" }}
      options={{
        plugins: [
          new StatsigAutoCapturePlugin(),
          new StatsigSessionReplayPlugin(),
        ],
      }}
    >
      {children}
    </StatsigProvider>
  );
}
