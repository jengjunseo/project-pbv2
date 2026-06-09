"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatRemaining } from "@/lib/time";

type CountdownProps = {
  seconds: number;
  onExpire?: () => void;
};

export function Countdown({ seconds, onExpire }: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }

    const timer = window.setTimeout(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [onExpire, remaining]);

  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900">
      <Timer className="h-4 w-4" aria-hidden="true" />
      {formatRemaining(remaining)}
    </div>
  );
}
