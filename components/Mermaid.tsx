"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Markdown.module.css";

let initialized = false;

/**
 * Renders a mermaid diagram from its source. Mermaid is imported dynamically so it
 * never touches the server bundle and is only paid for on pages that use it. On a
 * parse error we fall back to showing the source, so a broken diagram never blanks
 * the page.
 */
export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      if (!initialized) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          fontFamily: "var(--font-sans)",
        });
        initialized = true;
      }
      try {
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return <pre className={styles.pre}>{chart}</pre>;
  }
  return <div ref={ref} className={styles.mermaid} />;
}
