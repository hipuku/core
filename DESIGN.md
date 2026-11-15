# core: design

How core looks and behaves, and how it is built on the haus design system: which haus components
and tokens it takes, the `core` brand, and what it keeps as its own.

## Contents

- [Visual language](#visual-language)
- [Typography](#typography)
- [Layout and interaction](#layout-and-interaction)
- [Design system](#design-system)
- [Known gaps](#known-gaps)

## Visual language

### Palette and surfaces

**Decision.** An off-white page, white cards separated by fill instead of borders, and accent
colours from a print-like palette of vermilion, mustard, teal and cobalt, at the saturation and
lightness of printed ink. The values are haus's `core` brand (`brands/core.css` in `haus-tokens`).
Notices are tinted, not raised, and the drift warning is the only one; status and authorship, which
used to be banners, are properties.

**Reason.** Visual choices, made by eye.

### Buttons

**Decision.** A labelled action is haus `Button`, and every one has a background. There is no
ghost variant; the default is the lightest fill. There is one filled accent per view, and Approve is
green instead of the accent. An icon-only control inside a container (the × on a row, a toolbar
button, a refresh beside a timestamp) is haus `IconButton`, filled on hover only.

**Reason.** A transparent button with a word in it reads as a link. The accent already marks
primary actions and links, so Approve needs its own colour. A toolbar of eight filled squares is
harder to scan than one that fills under the pointer.

## Typography

### Typefaces

**Decision.** Gabarito for text and Geist Mono for code, paths and diffs, loaded with
`next/font/google`.

**Reason.** Visual choices, made by eye.

### Write and Preview use the same type

**Decision.** The compose editor has no field backgrounds or borders, and its type metrics match the
rendered markdown. Each ADR section is marked by a left gutter rule that takes the accent colour on
focus.

**Reason.** Text does not reflow between Write and Preview.

## Layout and interaction

### Editing is its own page

**Decision.** Editing an existing decision uses the same page as composing a new one.

**Reason.** Inline editing left the properties, notices and tabs above the editor, with two Edit
buttons visible at once.

### One sheet on the decision page

**Decision.** The document is the one white sheet. Properties, notices and tabs sit on the page
background, and every region shares the sheet's width. The dossier card is the exception: it holds
status, owner and dates, and the activity history opens inside it.

**Reason.** The page had five cards at three widths, on two backgrounds and two elevations. The
dossier's dates summarise the history, so the history opens where they are.

### Irreversible transitions ask first

**Decision.** Approve, Reject and Deprecate each open a confirmation (`ConfirmAction`, over haus
`Modal`) whose primary button has the tone of the button that opened it. Supersede has its own
modal, to choose the replacement. The drift re-check has no confirmation.

**Reason.** The lifecycle has no transition back, and Approve also makes the decision immutable.

### File tokens

**Decision.** A file path is shown two ways. A chip sits in a line of text and shows the filename.
A row sits in a list, shows the full path, and has a slot on the right for a drift badge, a remove
button or a range picker.

**Reason.** Visual choice.

### Recovering unsaved work

**Decision.** A local copy found on return to the compose page is offered, not applied.

**Reason.** Replacing what is on screen with older text would lose the newer text.
[ARCHITECTURE § Local autosave and server drafts](ARCHITECTURE.md#local-autosave-and-server-drafts)
covers where each copy lives.

## Design system

### Tokens

**Decision.** core takes `haus-tokens`: the primitives, the semantic roles and its own brand,
`brands/core.css`. `app/globals.css` declares a few short aliases over haus roles (`--r-sm` reads
`--haus-radius-control`), and component styles read those or `--haus-*` properties. Status badges
use haus `Badge` tones (haus decision 0021) and the strength meter, timeline and diff colours read
haus's feedback roles; core's six `--st-*` status tokens are deleted.

**Reason.** haus 1.0.0 published a token contract, so the names core reads no longer move with
haus's releases.

**Alternatives.** core did not use haus at first, because a library still changing its interface
would have moved core's with it.

### Components taken from haus

**Decision.** Thirteen haus components, imported in 27 files: `Button`, `IconButton`, `Modal`,
`Input`, `Select`, `Badge`, `Card`, `Callout`, `EmptyState`, `Tabs`, `Popover`, `Avatar`, and
`Toast`'s surface.

- The account menu is `Avatar` inside `Popover` with `role="menu"`, replacing core's own open,
  close, outside-click and placement code. The avatar's fill is haus's, derived from the name.
- The Write and Preview switch is `Tabs` with `appearance="segmented"`. Its tablist is a sticky
  toolbar with the form between it and the document sheet, which `haus#67` made possible by giving
  `Tabs` a `panelId`.
- `Select` is the themed picker haus used to call `Listbox`.

Four adapters each add one thing haus does not know about: `SubmitButton` and `SubmitIconButton`
read `useFormStatus`, which only works inside the form; `ModalShell` sets
`dismissOnBackdrop={false}` and focuses the first field; `ConnectGithubButton` starts the OAuth flow.

**Reason.** Each replaced core's own code for the same job. The account menu's open, close,
outside-click and placement code went when it moved to `Popover`.

### Components core keeps

**Decision.** core keeps what a design system has no model of:

- **Domain:** `DecisionEditor`, `DecisionMeta`, `DecisionReferences`, `Lineage`, `DraftList`.
- **Citations:** `FileBrowser`, `FileToken`, `ReferenceField`, `LiveReferenceField`,
  `CitationInsert`.
- **Content rendering:** `Markdown` and `Mermaid`, which wrap libraries.
- **The shell:** `AuthShell`, `TopBar`, `AuthForm`, `DemoCredentials`.
- **`PasswordField`**, built on haus `Input` with the reveal toggle in the `suffix` slot. The
  strength meter is core's.
- **The editor's `<textarea>`**, the writing surface, with a ref, keyboard handling and its own
  sizing.
- **sonner** for the toast queue. core renders haus `Toast`'s surface inside sonner with
  `toast.custom`, in `lib/toast.tsx`.

**Reason.** haus `Textarea` adds label and hint markup the writing surface does not need. haus
`Toast` is a surface with no provider, queue, positioning or dismissal (haus decision 0008), so
sonner queues and dismisses and haus draws.

### Accessibility

**Decision.** Keyboard access is covered by an end-to-end test, and form labels sit beside their
inputs rather than wrapping them.

**Reason.** A wrapping label made `PasswordField`'s accessible name "Password Show, edit text" and
moved focus into the field on every reveal, which the end-to-end test found. haus `Input` places its
label the same way.

### Enforcement

**Decision.** Stylelint flags every declaration that bypasses the token layer, and
`scripts/check-token-debt.mjs` holds the count: it fails when the number moves in either direction
without `scripts/token-debt.json` moving with it. CodeRabbit's rules for this repo flag a raw value
in a CSS module and a local component that duplicates a haus one.

**Reason.** The strict-value rule is a warning, because 355 failures on the day it was added would
have meant switching it off. The ratchet stops the count rising and stops it going stale when it
falls.

## Known gaps

- **Token debt: 11** declarations with no haus token: two `em` paddings, two `min-height`, two
  `z-index`, the app shell's padding, the password field's right padding for its reveal button, a
  negative margin, a `box-shadow` and a `4px` radius. It started at 355. Zero is not the target.
- **A citation with no matching reference looks inconsistent.** A file cited in the text is not
  checked for drift ([FEATURE § Not built](FEATURE.md#not-built)); a "track this file" control on
  the citation is the likely next step.
