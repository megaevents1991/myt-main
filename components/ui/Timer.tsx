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

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          onTimeElapsed();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onTimeElapsed]);

  return <div className="font-bold">{formatTime(secondsLeft)}</div>;
};
