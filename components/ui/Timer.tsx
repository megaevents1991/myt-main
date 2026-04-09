import React, { useEffect, useState } from "react";

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

export const Timer = ({
  onTimeElapsed,
  duration = 60,
}: {
  onTimeElapsed: () => void;
  duration?: number;
}) => {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(duration - elapsed, 0);
      setSecondsLeft(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        onTimeElapsed?.();
      }
    };

    const timer = setInterval(tick, 1000);
    tick();

    return () => clearInterval(timer);
  }, [startTime, duration, onTimeElapsed]);

  return <div className="font-bold">{formatTime(secondsLeft)}</div>;
};
