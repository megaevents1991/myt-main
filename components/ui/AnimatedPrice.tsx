import React, { useState, useEffect, useMemo } from "react";

type AnimatedPriceProps = {
  value: string; // e.g. "$1,706" or "₪ 1,706.45"
};

function InnerRoll({ wrappers, direction, rollIdx, idx }: { wrappers: string[]; direction: 'up' | 'down'; rollIdx: number; idx: number; }) {
  wrappers = wrappers.slice()
  const txt = wrappers.shift();
  if (txt === undefined) return null;

  return (
    <span>
      {txt}
      <InnerRoll
        wrappers={wrappers}
        direction={direction}
        rollIdx={rollIdx}
        idx={idx + 1}
    />
    </span>
  );
}

export const AnimatedPrice: React.FC<AnimatedPriceProps> = ({ value }) => {
  const num = Number(value.replace(/[^\d.]/g, ''));
  const [previousValue, setPreviousValue] = useState(num);
  const [changed, setChanged] = useState(false);

  const wrappers = useMemo(() => {
    const parts = value.split(/(\d)/g).map((part) => ({ txt: part, isDigit: /\d/.test(part) }));
    let currentWrapperTxt = '';
    const list: string[] = [];
    for (const part of parts) {
      currentWrapperTxt += part.txt;
      if (!part.isDigit) {
        list.push(currentWrapperTxt);
        currentWrapperTxt = '';
      }
    }
    if (currentWrapperTxt) list.push(currentWrapperTxt);
    return list;
  }, [value]);

  const [roll, setRoll] = useState<{ rollIdx: number; direction: 'up' | 'down' }>({ rollIdx: -1, direction: 'down' });

  useEffect(() => {
    if (num === previousValue) return;
    const direction = num > previousValue ? 'up' : 'down';
    setPreviousValue(num);

    const max = Math.max(num, previousValue);
    let significant = Math.pow(10, Math.floor(Math.log10(max)));
    let idx = 1;
    while (significant >= 1) {
      if (
        num - (num % significant) !==
        previousValue - (previousValue % significant)
      ) {
        break;
      }
      idx++;
      significant /= 10;
    }
    setRoll({ rollIdx: idx, direction });
    setChanged(true);
    setTimeout(() => {
      setRoll({ rollIdx: -1, direction });
      setChanged(false);
    }, 1000);
  }, [num, previousValue]);

  return (
    <span className={`inline-block ${changed ? 'animate-pulse-scale' : ''}`}>
      <InnerRoll
        wrappers={wrappers}
        direction={roll.direction}
        rollIdx={roll.rollIdx}
        idx={0}
      />
    </span>
  );
};
