import { FileCode2 } from "lucide-react";
import styles from "./FileToken.module.css";

/**
 * How a cited file looks, everywhere it appears.
 *
 * There were four renderings of the same idea (inline in prose, as a pill in
 * the editor, as a plain line in the document, as a search result) which meant
 * a path looked like a different kind of object depending on which screen you
 * were on. Two arrangements are enough, and the difference between them is
 * structural rather than decorative:
 *
 * - **Chip** sits *inside a line of text*. It carries the filename only,
 *   because a full path cannot sit mid-sentence without wrecking the measure.
 * - **Row** sits *in a list*. It carries the whole path, because in a list you
 *   are identifying and managing files rather than reading around them, and it
 *   offers a slot on the right for whatever that list needs there.
 *
 * Both share the icon, the mono face and the accent on hover, so the two read
 * as one object seen at two sizes.
 */

export interface FileTokenProps {
  /** `owner/repo`. */
  repo: string;
  path: string;
  /** `L47-L120`, or null for the whole file. */
  lines?: string | null;
}

/** Just the filename: what a reader scans for in a sentence. */
export function fileName(path: string): string {
  return path.split("/").pop() || path;
}

/** Inline, in prose. */
export function FileChip({
  repo,
  path,
  lines,
  href,
}: FileTokenProps & { href?: string }) {
  const label = lines ? `${fileName(path)} · ${lines}` : fileName(path);
  const title = `${repo} · ${path}`;

  if (!href) {
    return (
      <span className={styles.chip} title={title}>
        <FileCode2 size={13} aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <a
      className={styles.chip}
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
    >
      <FileCode2 size={13} aria-hidden="true" />
      {label}
    </a>
  );
}

/**
 * In a list. `children` is the right-hand slot: a drift badge when reading, a
 * remove control when editing, a range picker when searching.
 */
export function FileRow({
  repo,
  path,
  lines,
  href,
  onClick,
  title,
  children,
}: FileTokenProps & {
  /** Makes the name a link out to the code. */
  href?: string;
  /** Makes the name a button, used where picking the row is the action. */
  onClick?: () => void;
  title?: string;
  children?: React.ReactNode;
}) {
  const name = (
    <>
      <FileCode2 size={14} className={styles.icon} aria-hidden="true" />
      <span className={styles.repo}>{repo}</span>
      <span className={styles.path}>{path}</span>
      {lines && <span className={styles.lines}>{lines}</span>}
    </>
  );

  return (
    <div className={styles.row}>
      {href ? (
        <a
          className={styles.name}
          href={href}
          title={title}
          target="_blank"
          rel="noopener noreferrer"
        >
          {name}
        </a>
      ) : onClick ? (
        <button type="button" className={styles.name} onClick={onClick} title={title}>
          {name}
        </button>
      ) : (
        <span className={styles.name} title={title}>
          {name}
        </span>
      )}
      {children && <span className={styles.slot}>{children}</span>}
    </div>
  );
}
