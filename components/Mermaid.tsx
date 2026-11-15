"use client";

import { useEffect, useState } from "react";
import styles from "./Markdown.module.css";

let initialized = false;

/**
 * Renders a mermaid diagram from its source. Mermaid is imported dynamically so it
 * never touches the server bundle and is only paid for on pages that use it. On a
 * parse error we fall back to showing the source, so a broken diagram never blanks
 * the page.
 */
export function Mermaid({ chart }: { chart: string }) {
  // The result is kept with the chart it came from, so a new chart is always
  // tried afresh: a failure on one source does not stick to the next.
  const [rendered, setRendered] = useState<{ chart: string; svg: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Inside the try, so a failed load shows the error state too.
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
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) setRendered({ chart, svg });
      } catch {
        if (!cancelled) setRendered({ chart, svg: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  const current = rendered?.chart === chart ? rendered : null;
  if (current && current.svg === null) {
    return <pre className={styles.pre}>{chart}</pre>;
  }
  // Mermaid renders with securityLevel "strict", which sanitises the SVG.
  return (
    <div className={styles.mermaid} dangerouslySetInnerHTML={{ __html: current?.svg ?? "" }} />
  );
}
