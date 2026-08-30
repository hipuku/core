"use client";

import {
  Bold,
  Code2,
  Eye,
  FileText,
  Heading,
  Italic,
  Link2,
  List,
  PenLine,
  Quote,
  RotateCcw,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Markdown, type CitationRepo } from "@/components/Markdown";
import { CitationInsertProvider } from "@/components/CitationInsert";
import { FileRow } from "@/components/FileToken";
import { ReferenceField } from "@/components/ReferenceField";
import { ModalShell } from "@/components/ModalShell";
import type { ActionResult } from "@/lib/action-result";
import type { DecisionStatus } from "@/lib/decisions/types";
import { insertCitation, untrackedCitations } from "@/lib/decisions/citation";
import {
  continueList,
  indent,
  insertFence,
  insertLink,
  toggleLinePrefix,
  wrap,
  type EditState,
} from "@/lib/markdown/editing";
import { useDraft } from "@/lib/use-draft";
import { timeAgo } from "@/lib/time-ago";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import styles from "./DecisionEditor.module.css";

const BLOCKS = [
  {
    name: "context",
    label: "Context",
    placeholder: "What situation forces a decision? What constraints matter?",
  },
  {
    name: "decision",
    label: "Decision",
    placeholder: "What are we deciding to do?",
  },
  {
    name: "consequences",
    label: "Consequences",
    placeholder: "What becomes easier or harder? What do we accept as a trade-off?",
  },
] as const;

type BlockName = (typeof BLOCKS)[number]["name"];
type Body = Record<BlockName, string>;
type Cited = {
  repoId: string;
  repo: string;
  path: string;
  /** `L47-L120`, when the author cited a span rather than the whole file. */
  lines: string | null;
};
type DraftShape = { title: string; body: Body; cited: Cited[] };

/**
 * The toolbar's real job is to say "this is markdown". Someone who has never
 * typed a `#` can still write a heading, and watches the syntax appear in the
 * text as they do, which teaches the shortcut the button is standing in for.
 *
 * Each entry is a pure `EditState -> EditState`; the component supplies the
 * block to run it against.
 */
const TOOLS = [
  { icon: Heading, label: "Heading", hint: null, edit: (s: EditState) => toggleLinePrefix(s, "## ") },
  { icon: Bold, label: "Bold", hint: "B", edit: (s: EditState) => wrap(s, "**") },
  { icon: Italic, label: "Italic", hint: "I", edit: (s: EditState) => wrap(s, "_") },
  { icon: Link2, label: "Link", hint: "K", edit: insertLink },
  { icon: List, label: "List", hint: null, edit: (s: EditState) => toggleLinePrefix(s, "- ") },
  { icon: Quote, label: "Quote", hint: null, edit: (s: EditState) => toggleLinePrefix(s, "> ") },
  { icon: Code2, label: "Code block", hint: null, edit: (s: EditState) => insertFence(s, "") },
  {
    icon: Share2,
    label: "Mermaid diagram",
    hint: null,
    edit: (s: EditState) => insertFence(s, "mermaid", "graph TD\n  A[Start] --> B[Decision]"),
  },
] as const;

/** Safe in event handlers, where there is definitively a browser. */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad/i.test(navigator.userAgent);
}

const noSubscription = () => () => {};

/**
 * The platform is a browser fact, so the server cannot know it. Read through
 * `useSyncExternalStore` rather than during render: the server snapshot is
 * `false`, the first client render matches it, and the real value arrives after
 * hydration. Calling `navigator` inline instead renders "Ctrl" on the server and
 * "⌘" on the client, which is a hydration mismatch.
 */
function useIsMac(): boolean {
  return useSyncExternalStore(noSubscription, isMacPlatform, () => false);
}

/* -------------------------------------------------------------------------- */
/* the editable block                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A textarea that behaves like a markdown editor: it grows with its content,
 * continues lists, indents with Tab, and takes the usual formatting shortcuts.
 * All of the text manipulation is pure (`lib/markdown/editing`); this only
 * applies the result and restores the caret.
 */
function MarkdownArea({
  name,
  value,
  onChange,
  placeholder,
  onFocus,
  areaRef,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onFocus: () => void;
  areaRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  /** Set by an edit, consumed once the new value has rendered. */
  const pendingSelection = useRef<[number, number] | null>(null);

  // Height follows content, so there is no inner scrollbar and no `rows` cap on
  // how much thinking fits in a block.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;

    if (pendingSelection.current) {
      const [start, end] = pendingSelection.current;
      pendingSelection.current = null;
      el.setSelectionRange(start, end);
    }
  }, [value]);

  const apply = useCallback(
    (next: EditState) => {
      pendingSelection.current = [next.start, next.end];
      onChange(next.value);
    },
    [onChange],
  );

  function stateOf(el: HTMLTextAreaElement): EditState {
    return { value: el.value, start: el.selectionStart, end: el.selectionEnd };
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    const mod = isMacPlatform() ? event.metaKey : event.ctrlKey;

    // ⌘↵ submits from anywhere in the document; the form's own submit button
    // is far away once the document is long.
    if (mod && event.key === "Enter") {
      event.preventDefault();
      el.form?.requestSubmit();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !mod) {
      const next = continueList(stateOf(el));
      if (next) {
        event.preventDefault();
        apply(next);
      }
      return;
    }

    if (event.key === "Tab" && !mod) {
      // Tab is the browser's "leave this field", but inside a markdown document
      // it is the only way to nest a list. Shift+Tab outdents; Escape then Tab
      // still gets you out of the field for keyboard-only navigation.
      event.preventDefault();
      apply(indent(stateOf(el), event.shiftKey ? -1 : 1));
      return;
    }

    if (!mod) return;

    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      apply(wrap(stateOf(el), "**"));
    } else if (key === "i") {
      event.preventDefault();
      apply(wrap(stateOf(el), "_"));
    } else if (key === "k") {
      event.preventDefault();
      apply(insertLink(stateOf(el)));
    } else if (key === "e") {
      event.preventDefault();
      apply(wrap(stateOf(el), "`"));
    }
  }

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        areaRef(el);
      }}
      id={name}
      name={name}
      className={styles.area}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      spellCheck
    />
  );
}

/* -------------------------------------------------------------------------- */
/* the editor                                                                  */
/* -------------------------------------------------------------------------- */

export function DecisionEditor({
  action,
  cancelHref,
  submitLabel,
  /** Only the propose flow sets a title; an accepted ADR's title is immutable. */
  withTitle = false,
  defaultTitle = "",
  defaults,
  defaultCited = [],
  workspaceId,
  note,
  draftKey,
  /** The key this decision will carry once proposed (`VAU-014`). */
  nextKey,
  citable = [],
  repoIds = [],
  headingKey,
  headingTitle,
  status,
  referencesSlot,
  previewCited = [],
  /** Present when composing can be parked as a server-side draft. */
  onSaveDraft,
  /** Set when this editor opened from an existing draft. */
  draftId,
  /** Deletes the server-side draft. Required whenever `draftId` is set. */
  onDiscardDraft,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  cancelHref: string;
  submitLabel: string;
  withTitle?: boolean;
  defaultTitle?: string;
  defaults: Body;
  /** Files already cited, set when reopening a draft. */
  defaultCited?: Cited[];
  /** Set when files can be cited while composing. */
  workspaceId?: string;
  note?: React.ReactNode;
  draftKey: string;
  nextKey?: string;
  /** Repos inline citations in the body can resolve against. */
  citable?: CitationRepo[];
  /** The same repos with their ids, so a citation can become a reference. */
  repoIds?: { id: string; repo: string }[];
  /** Revising an existing decision: its key, title and status, for the header. */
  headingKey?: string;
  headingTitle?: string;
  status?: DecisionStatus;
  /** Reference management, rendered in place of the compose-time picker. */
  referencesSlot?: React.ReactNode;
  /** What Preview should list when the editor does not own the citations. */
  previewCited?: { repo: string; path: string; lines: string | null }[];
  onSaveDraft?: (formData: FormData) => Promise<ActionResult | void>;
  draftId?: string;
  onDiscardDraft?: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState<Body>(defaults);
  const [cited, setCited] = useState<Cited[]>(defaultCited);
  // Compose holds its citations in state; revising is handed them as a prop.
  const previewRefs = workspaceId ? cited : previewCited;
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  /** Where the blocked navigation was heading, when the guard opened the modal. */
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const router = useRouter();

  /** The block a formatting button should act on: the last one focused. */
  const [activeBlock, setActiveBlock] = useState<BlockName>("context");
  const areas = useRef(new Map<BlockName, HTMLTextAreaElement>());

  const pristine =
    title === defaultTitle &&
    BLOCKS.every((b) => body[b.name] === defaults[b.name]) &&
    cited.length === defaultCited.length;

  // The topbar's back arrow is an ordinary link in a component that knows
  // nothing about this form, so the guard works at the document level.
  useUnsavedGuard({
    when: !pristine && !submitting,
    onBlocked: useCallback((href: string) => {
      setPendingHref(href);
      setConfirmingDiscard(true);
    }, []),
  });

  /**
   * Files named in the prose that no reference covers. Computed over all three
   * blocks, because a citation in Context is as much a claim as one in the
   * Decision.
   */
  const untracked = useMemo(() => {
    const prose = BLOCKS.map((b) => body[b.name]).join("\n\n");
    // Compose holds its citations in state; revising was handed the ones the
    // decision already has.
    const tracked = (workspaceId ? cited : previewCited).map((c) => ({
      repo: c.repo,
      path: c.path,
    }));
    return untrackedCitations(prose, tracked)
      .map((citation) => {
        const repo = repoIds.find((r) => r.repo === citation.repo);
        // A citation naming a repo this workspace has not connected cannot be
        // tracked, and offering to would be a button that does nothing.
        return repo
          ? { repoId: repo.id, repo: citation.repo, path: citation.path, lines: citation.lines }
          : null;
      })
      .filter((f) => f !== null);
  }, [body, cited, previewCited, workspaceId, repoIds]);

  const draftValue = useMemo<DraftShape>(() => ({ title, body, cited }), [title, body, cited]);
  const draft = useDraft<DraftShape>({
    key: draftKey,
    value: draftValue,
    pristine,
    // Once a draft exists on the server it is visible in the decisions list,
    // which is a better recovery route than a banner. The local copy is the net
    // for work that has never reached the server at all, so it is kept only for
    // a fresh compose session.
    enabled: !submitting && !draftId,
  });

  /**
   * A local draft is only worth offering if it differs from what the editor
   * opened with. Reopening a saved draft rehydrates the same text from the
   * server, so the local copy matches it exactly, and offering to "restore" that
   * is noise, and worse, implies there is unsent work when there is none.
   */
  const recoverable = useMemo(() => {
    const stored = draft.found;
    if (!stored) return null;
    const sameAsOpened =
      (stored.data.title ?? "") === defaultTitle &&
      BLOCKS.every((b) => (stored.data.body?.[b.name] ?? "") === defaults[b.name]) &&
      (stored.data.cited?.length ?? 0) === defaultCited.length;
    return sameAsOpened ? null : stored;
  }, [draft.found, defaultTitle, defaults, defaultCited.length]);

  const restore = () => {
    if (!recoverable) return;
    const { data } = recoverable;
    setTitle(data.title ?? "");
    setBody({ ...defaults, ...data.body });
    setCited(data.cited ?? []);
    draft.dismiss();
  };

  // Escape backs out of the discard confirmation rather than trapping it open.
  useEffect(() => {
    if (!confirmingDiscard) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirmingDiscard(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmingDiscard]);

  /** Run a pure edit against whichever block is active, then refocus it. */
  const format = (edit: (state: EditState) => EditState) => {
    const el = areas.current.get(activeBlock);
    if (!el) return;
    const next = edit({ value: el.value, start: el.selectionStart, end: el.selectionEnd });
    setBody((b) => ({ ...b, [activeBlock]: next.value }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  };

  const mod = useIsMac() ? "⌘" : "Ctrl";

  return (
    <form
      className={styles.editor}
      action={async (formData) => {
        setSubmitting(true);
        try {
          // `propose` redirects and never returns; `revise` returns an ActionResult.
          const result = await action(formData);
          if (result?.error) {
            setSubmitting(false);
            toast.error(result.error);
            return;
          }
          // Only now is the text safe on the server.
          draft.clear();
          if (result?.ok) toast.success(result.ok);
        } catch (error) {
          // A redirect is thrown rather than returned. That path is a success, and the
          // draft has to go before the navigation completes.
          draft.clear();
          throw error;
        }
      }}
    >
      {/* ---- properties: what this document becomes once proposed ---------- */}
      {draftId && <input type="hidden" name="draftId" value={draftId} />}

      {/* The chips carry their own meaning, an identifier and a state, so they
          are shown without labels explaining what an identifier is. The tag says
          Draft, because that is what this is until it is proposed; the key is
          what it *will* take, which is why it stays dashed until then. */}
      {withTitle ? (
        <div className={styles.props}>
          <span
            className="key-chip key-chip--pending"
            title="The number this decision takes when you propose it"
          >
            {nextKey ?? "—"}
          </span>
          <span className="pill pill--draft">Draft</span>
        </div>
      ) : (
        headingKey && (
          <div className={styles.props}>
            <span className="key-chip">{headingKey}</span>
            {status && <span className={`pill pill--${status}`}>{status}</span>}
            {headingTitle && (
              <span className={styles.headingTitle}>{headingTitle}</span>
            )}
          </div>
        )
      )}

      {/* ---- sticky bar: mode, formatting, actions ------------------------- */}
      <div className={styles.bar}>
        <div className={styles.barLeft}>
          <div className={styles.seg} role="tablist" aria-label="Editor mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "write"}
              className={`${styles.segBtn} ${tab === "write" ? styles.segOn : ""}`}
              onClick={() => setTab("write")}
            >
              <PenLine size={14} />
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "preview"}
              className={`${styles.segBtn} ${tab === "preview" ? styles.segOn : ""}`}
              onClick={() => setTab("preview")}
            >
              <Eye size={14} />
              Preview
            </button>
          </div>

          {tab === "write" && (
            <div className={styles.tools} role="toolbar" aria-label="Formatting">
              {TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  className={`iconbtn ${styles.tool}`}
                  // Keep the caret in the textarea; a focused button would lose
                  // the selection the edit is about to act on.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => format(tool.edit)}
                  title={tool.hint ? `${tool.label} · ${mod}${tool.hint}` : tool.label}
                  aria-label={tool.label}
                >
                  <tool.icon size={15} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.barRight}>
          {pristine ? (
            <Link href={cancelHref} className="btn">
              Cancel
            </Link>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPendingHref(null);
                setConfirmingDiscard(true);
              }}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            <Send size={16} />
            {submitLabel}
          </button>
        </div>
      </div>

      {/* ---- a draft found from a previous session ------------------------- */}
      {recoverable && (
        <div className={styles.recovered} role="status">
          <RotateCcw size={16} className={styles.recoveredIcon} />
          <span>
            You have an unsent draft from <strong>{timeAgo(recoverable.savedAt)}</strong>.
          </span>
          <span className={styles.recoveredActions}>
            <button type="button" className="btn" onClick={restore}>
              Restore it
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => draft.clear()}
            >
              Discard
            </button>
          </span>
        </div>
      )}

      {/* ---- the document -------------------------------------------------- */}
      <div className={styles.sheet}>
        {/* The write pane stays mounted while previewing so its fields still submit. */}
        <div className={tab === "preview" ? styles.hidden : undefined}>
          {withTitle && (
            <input
              name="title"
              required
              className={styles.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled decision"
              aria-label="Title"
            />
          )}
          {BLOCKS.map((b) => (
            <section key={b.name} className={styles.block}>
              <label className={styles.blockLabel} htmlFor={b.name}>
                {b.label}
              </label>
              <MarkdownArea
                name={b.name}
                value={body[b.name]}
                onChange={(v) => setBody((prev) => ({ ...prev, [b.name]: v }))}
                onFocus={() => setActiveBlock(b.name)}
                placeholder={b.placeholder}
                areaRef={(el) => {
                  if (el) areas.current.set(b.name, el);
                  else areas.current.delete(b.name);
                }}
              />
            </section>
          ))}

          {(workspaceId || referencesSlot) && (
            <fieldset className={styles.block}>
              <legend className={styles.blockLabel}>Referenced code</legend>
              {/* Without this the field looks like somewhere to file links. It
                  is the feature that makes a decision code-aware, and it costs
                  one sentence to say so. */}
              <p className={styles.blockHint}>
                Files this decision governs. Their state is recorded now, and
                you&rsquo;ll be told when the cited code changes. Cite specific
                lines where you can. A whole file drifts on any edit to it.
              </p>
              {/* The slot comes from a server component, so it cannot be
                  handed a callback: context reaches it where props cannot. */}
              <CitationInsertProvider
                value={{
                  insert: (citable) =>
                    format((state) => insertCitation(state, citable)),
                  untracked,
                }}
              >
                {referencesSlot}
              </CitationInsertProvider>
              {workspaceId && (
                <ReferenceField
                  workspaceId={workspaceId}
                  chips={cited.map((c) => ({
                    key: `${c.repoId}:${c.path}:${c.lines ?? ""}`,
                    repo: c.repo,
                    path: c.path,
                    lines: c.lines,
                  }))}
                  withHiddenInputs
                  repoIdOf={(chip) => chip.key.split(":")[0] ?? ""}
                  onAdd={(file, lines) =>
                    setCited((list) =>
                      list.some(
                        (x) =>
                          x.repoId === file.repoId &&
                          x.path === file.path &&
                          x.lines === lines,
                      )
                        ? list
                        : [
                            ...list,
                            {
                              repoId: file.repoId,
                              repo: file.repo,
                              path: file.path,
                              lines,
                            },
                          ],
                    )
                  }
                  onRemove={(chip) =>
                    setCited((list) =>
                      list.filter(
                        (x) => `${x.repoId}:${x.path}:${x.lines ?? ""}` !== chip.key,
                      ),
                    )
                  }
                  untracked={untracked}
                  onTrack={(file, lines) =>
                    setCited((list) =>
                      list.some(
                        (x) => x.repoId === file.repoId && x.path === file.path && x.lines === lines,
                      )
                        ? list
                        : [...list, { repoId: file.repoId, repo: file.repo, path: file.path, lines }],
                    )
                  }
                  onInsert={(chip) =>
                    format((state) =>
                      insertCitation(state, {
                        repo: chip.repo,
                        path: chip.path,
                        lines: chip.lines,
                      }),
                    )
                  }
                />
              )}
            </fieldset>
          )}
        </div>

        {/* Mounted only when active, so mermaid renders into a visible container. */}
        {tab === "preview" && (
          <div>
            {withTitle && (
              <h2 className={styles.pvTitle}>
                {title || <span className={styles.pvUntitled}>Untitled decision</span>}
              </h2>
            )}
            {BLOCKS.map((b) => (
              <section key={b.name} className={styles.block}>
                <span className={styles.blockLabel}>{b.label}</span>
                {body[b.name].trim() ? (
                  <Markdown citable={citable}>{body[b.name]}</Markdown>
                ) : (
                  <p className={styles.pvEmpty}>Not yet written.</p>
                )}
              </section>
            ))}
            {(workspaceId || referencesSlot) && (
              <section className={styles.block}>
                <span className={styles.blockLabel}>Referenced code</span>
                {/* Preview is a rehearsal of the document, so it shows what a
                    reader sees: the citations, with no way to change them and
                    none of the authoring guidance above. */}
                {previewRefs.length > 0 ? (
                  <ul className={styles.pvRefs}>
                    {previewRefs.map((c) => (
                      <li key={`${c.repo}:${c.path}:${c.lines ?? ""}`}>
                        <FileRow repo={c.repo} path={c.path} lines={c.lines} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.pvEmpty}>Nothing referenced.</p>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.syntax}>
          <kbd>{mod}</kbd>
          <kbd>B</kbd> bold · <kbd>{mod}</kbd>
          <kbd>K</kbd> link · <kbd>Tab</kbd> indent · <kbd>{mod}</kbd>
          <kbd>↵</kbd> {submitLabel.toLowerCase()}
        </span>
        {note && <p className={styles.note}>{note}</p>}
      </div>

      {/* ---- leaving with unsaved work -------------------------------------
          Three outcomes, because there genuinely are three. "Save as draft" is
          the one that makes Cancel safe to press, so it leads; discarding is
          destructive and reads as such. */}
      {confirmingDiscard && (
        <ModalShell
          title="You have unsaved work"
          onClose={() => {
            setConfirmingDiscard(false);
            setPendingHref(null);
          }}
        >
          <p className={styles.modalText}>
            {onSaveDraft
              ? "Park it as a draft and pick it up later, or discard it. A draft is private to you until you propose it."
              : "Leaving now discards the changes you have made."}
          </p>
          <div className={styles.modalActions}>
            <button
              type="button"
              className="btn btn--danger"
              disabled={discarding}
              onClick={async () => {
                setDiscarding(true);
                try {
                  // A parked draft has to go from the server as well, or
                  // "discard" would leave it sitting in the decisions list.
                  if (draftId && onDiscardDraft) await onDiscardDraft(draftId);
                  draft.clear();
                  router.push(pendingHref ?? cancelHref);
                } catch {
                  setDiscarding(false);
                  toast.error("Could not discard that draft.");
                }
              }}
            >
              <Trash2 size={15} />
              Discard
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setConfirmingDiscard(false);
                setPendingHref(null);
              }}
            >
              Keep editing
            </button>
            {onSaveDraft && (
              <button
                type="submit"
                className="btn btn--primary"
                formNoValidate
                formAction={async (formData) => {
                  const result = await onSaveDraft(formData);
                  if (result?.error) {
                    toast.error(result.error);
                    return;
                  }
                  // The text is on the server now; the local copy has done its job.
                  draft.clear();
                  toast.success(result?.ok ?? "Saved as a draft.");
                  // Continue to wherever they were heading, not always "back".
                  router.push(pendingHref ?? cancelHref);
                }}
              >
                <FileText size={15} />
                Save as draft
              </button>
            )}
          </div>
        </ModalShell>
      )}
    </form>
  );
}
