"use client";

import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid";
import styles from "./Markdown.module.css";

/** Render user-authored markdown. ```mermaid fences become diagrams. */
export function Markdown({ children }: { children: string }) {
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
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
