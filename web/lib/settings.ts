"use client";

import { useCallback, useEffect, useState } from "react";

export interface Settings {
  cardDensity: "comfortable" | "compact";
  showFitBadge: boolean;
}

const DEFAULTS: Settings = {
  cardDensity: "comfortable",
  showFitBadge: true,
};

const KEY = "recs.settings";

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return [settings, update];
}
