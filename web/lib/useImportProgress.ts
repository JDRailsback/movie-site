"use client";

import { useEffect, useRef, useState } from "react";
import { type ImportState, getImportStatus, importEventsUrl } from "./api";

export interface ImportProgress {
  status: ImportState;
  counts: Record<string, number>;
  error?: string;
}

interface ProgressEvent {
  status: ImportState;
  error?: string;
  [k: string]: unknown;
}

const TERMINAL: ImportState[] = ["ready", "failed"];

/**
 * Subscribe to an import's SSE progress stream. Falls back to a single status
 * fetch on mount so a late subscriber (events already published) still resolves.
 */
export function useImportProgress(importId: string): ImportProgress {
  const [progress, setProgress] = useState<ImportProgress>({
    status: "queued",
    counts: {},
  });
  const settled = useRef(false);

  useEffect(() => {
    // Reconcile in case the import already finished before we subscribed.
    getImportStatus(importId)
      .then((s) => {
        if (TERMINAL.includes(s.status) && !settled.current) {
          settled.current = true;
          setProgress({ status: s.status, counts: s.stageCounts, error: s.error ?? undefined });
        }
      })
      .catch(() => {});

    const es = new EventSource(importEventsUrl(importId));
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data) as ProgressEvent;
      const { status, error, ...counts } = evt;
      setProgress({ status, counts: counts as Record<string, number>, error });
      if (TERMINAL.includes(status)) {
        settled.current = true;
        es.close();
      }
    };
    es.onerror = () => es.close();

    return () => es.close();
  }, [importId]);

  return progress;
}
