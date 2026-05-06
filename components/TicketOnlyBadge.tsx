"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export function TicketOnlyBadge() {
  const [open, setOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLDivElement>(null);

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const TOOLTIP_WIDTH = 210;
    const MARGIN = 10;

    let rightPos = window.innerWidth - rect.right;
    const leftEdge = rect.right - TOOLTIP_WIDTH;
    if (leftEdge < MARGIN) {
      rightPos = window.innerWidth - TOOLTIP_WIDTH - MARGIN;
    }
    rightPos = Math.max(rightPos, MARGIN);

    setTooltipPos({
      top: rect.bottom + window.scrollY + 9,
      right: rightPos,
    });
  }, []);

  /* ── Desktop: hover ── */
  const handleMouseEnter = () => { calcPos(); setOpen(true); };
  const handleMouseLeave = () => setOpen(false);

  /* ── Desktop: click (mouse) ── */
  const handleClick = (e: React.MouseEvent) => {
    // only handle real mouse clicks — touch is handled by onTouchEnd
    if (e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType === "touch") return;
    e.preventDefault();
    e.stopPropagation();
  };

  /* ── Mobile: touchEnd is the authoritative handler ──
     Calling e.preventDefault() here stops the browser from synthesising
     a 'click' event, so the parent <Link> is never triggered.          */
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();          // ← prevents click synthesis → no Link navigation
    e.stopPropagation();
    if (!open) {
      calcPos();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();         // stop Link from seeing the touch
  };

  /* close on outside tap — only register 200ms after open to avoid
     the opening touch event from immediately closing the tooltip     */
  useEffect(() => {
    if (!open) return;
    let closeHandler: ((e: Event) => void) | null = null;
    const timerId = setTimeout(() => {
      closeHandler = (e: Event) => {
        if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("touchend", closeHandler, { passive: true });
      document.addEventListener("click",    closeHandler);
    }, 200);

    return () => {
      clearTimeout(timerId);
      if (closeHandler) {
        document.removeEventListener("touchend", closeHandler);
        document.removeEventListener("click",    closeHandler);
      }
    };
  }, [open]);

  /* reposition on scroll / resize */
  useEffect(() => {
    if (!open) return;
    const update = () => calcPos();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open, calcPos]);

  const tooltip =
    typeof document !== "undefined" && open
      ? createPortal(
          <div
            style={{
              position: "absolute",
              top: tooltipPos.top,
              right: tooltipPos.right,
              zIndex: 99999,
              background: "#05203C",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              padding: "9px 15px",
              borderRadius: "10px",
              whiteSpace: "normal",
              maxWidth: "210px",
              lineHeight: "1.45",
              textAlign: "right",
              boxShadow: "0 8px 28px rgba(5,32,60,.32)",
              direction: "rtl",
              pointerEvents: "none",
              fontFamily: "inherit",
              animation: "tob-in .18s ease both",
            }}
          >
            ניתן להזמין כרטיס בלבד לאירוע זה
            <span
              style={{
                position: "absolute",
                top: -5,
                right: 12,
                width: 9,
                height: 9,
                background: "#05203C",
                transform: "rotate(45deg)",
                display: "block",
              }}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <style>{`
        @keyframes tob-in {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div
        className="absolute top-2 right-2 z-20"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div
          ref={btnRef}
          className="flex items-center justify-center rounded-full cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95"
          style={{
            background: "#277E89",
            boxShadow: "0 2px 10px rgba(39,126,137,.45)",
            width: 32,
            height: 32,
            WebkitTapHighlightColor: "transparent",
            userSelect: "none",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="status"
          aria-label="ניתן להזמין כרטיס בלבד לאירוע זה"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
            <line x1="9" y1="4.5" x2="9" y2="19.5" strokeDasharray="2.5 2" />
          </svg>
        </div>
      </div>

      {tooltip}
    </>
  );
}
