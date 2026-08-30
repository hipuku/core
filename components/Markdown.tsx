"use client";

import { isValidElement, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderCitations, type Citation } from "@/lib/decisions/citation";
import { FileChip } from "./FileToken";
import { Mermaid } from "./Mermaid";
import styles from "./Markdown.module.css";

/** A repo this document may cite, and the branch its links should point at. */
export interface CitationRepo {
  /** `owner/name`. */
  repo: string;
  branch: string;
}

/**
 * Render user-authored markdown. ```mermaid fences become diagrams, and
 * `{{owner/repo:path#L1-L20}}` citations become links to the cited code.
 *
 * Citations are rewritten to ordinary markdown links before parsing rather than
 * handled by a remark plugin: the token is a plain-text convention, and turning
 * it into syntax the parser already understands keeps the rendering path, and
 * its escaping, the one react-markdown has already hardened.
 */
export function Markdown({
  children,
  citable = [],
}: {
  children: string;
  /** Repos whose files this document may cite. Without these, tokens render as code. */
  citable?: CitationRepo[];
}) {
  const source = useMemo(() => {
    if (citable.length === 0) return children;
    return renderCitations(children, (citation: Citation) => {
      const known = citable.find((r) => r.repo === citation.repo);
      if (!known) return null;
      const path = citation.path.split("/").map(encodeURIComponent).join("/");
      const anchor = citation.lines ? `#${citation.lines}` : "";
      return `https://github.com/${known.repo}/blob/${known.branch}/${path}${anchor}`;
    });
  }, [children, citable]);

  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            const el = Array.isArray(children) ? children[0] : children;
            if (isValidElement(el)) {
              const props = el.props as {
                className?: string;
                children?: ReactNode;
              };
              const match = /language-(\w+)/.exec(props.className ?? "");
              if (match?.[1] === "mermaid") {
                const code = String(props.children ?? "").replace(/\n$/, "");
                return <Mermaid chart={code} />;
              }
            }
            return <pre className={styles.pre}>{children}</pre>;
          },
          a({ children, href }) {
            // A link into a repo blob came from a citation, and renders as the
            // shared file chip rather than as prose-coloured link text.
            const blob = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/[^/]+\/(.+?)(?:#(.+))?$/.exec(
              href ?? "",
            );
            if (blob) {
              return (
                <FileChip
                  repo={blob[1]!}
                  path={decodeURIComponent(blob[2]!)}
                  lines={blob[3] ?? null}
                  href={href}
                />
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
