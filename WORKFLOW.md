# core: workflow

How changes get into core: branches, pull requests, the checks that gate them, review,
dependencies, deployment and releases.

## Contents

- [Branches and pull requests](#branches-and-pull-requests)
- [Checks](#checks)
- [Review](#review)
- [Dependencies](#dependencies)
- [Design](#design)
- [Deployment](#deployment)
- [Releases](#releases)

---

## Branches and pull requests

Nothing is committed to `main` directly. Every change goes through a branch named
`<type>/<short-name>` (`feat`, `fix`, `design`, `a11y`, `docs`, `refactor`, `chore`, `deps`) and a
pull request that uses the template, carries one type label, and is squash merged. The pull request
title becomes the commit on `main`, and labels group the release notes.

The `main` ruleset requires a pull request, the checks below, branches up to date with `main`,
resolved conversations and a linear history, and it applies to the owner too.

## Checks

| Check      | Workflow | Runs                                                                                                | Required |
| ---------- | -------- | --------------------------------------------------------------------------------------------------- | -------- |
| Lint       | `ci.yml` | `npm run lint` (ESLint), `lint:prose`, `lint:css` (Stylelint) and `lint:tokens` (the token ratchet) | Yes      |
| Format     | `ci.yml` | `npm run format:check`                                                                              | Yes      |
| Typecheck  | `ci.yml` | `npm run typecheck`                                                                                 | Yes      |
| Test       | `ci.yml` | `npm test`, both Vitest projects                                                                    | Yes      |
| Build      | `ci.yml` | `npm run build`, after Lint, Typecheck and Test pass                                                | Yes      |
| End to end | `ci.yml` | `npm run e2e` against a Postgres service container, after Lint, Typecheck and Test pass             | Yes      |

Vercel builds a preview of every pull request as well; it is not a required check. What each suite
covers is in [ARCHITECTURE.md § Testing and CI](./ARCHITECTURE.md#testing-and-ci).

## Review

CodeRabbit reviews every pull request that is not a draft. Its configuration, `.coderabbit.yaml`,
gives it this repo's rules by path:

- **CSS modules:** tokens only (haus's `--haus-*` properties or the aliases in `app/globals.css`),
  with no new raw colour, length, radius, shadow, z-index or font value.
- **Components and pages:** haus components where haus has one, and interactive elements with an
  accessible name and keyboard handling.
- **The domain (`lib/decisions`, `lib/versioning`):** code depends on the store ports, paired writes
  share a transaction, and guards return a reason.
- **Server actions:** failures are returned as messages, not thrown.
- **Markdown:** Australian English, topic-label headings, and claims the code supports.

It is not a required check. Each comment is applied in a commit or answered with a reason, then
resolved; the ruleset will not merge a pull request with an open conversation.

## Dependencies

Dependabot opens grouped pull requests every Monday (Next, React, the database packages, the test
runner and the linters each move as a group), plus GitHub Actions monthly. Each carries the `deps`
label. Major updates to TypeScript, `@types/node` and ESLint are deferred, with the reason in
`.github/dependabot.yml`.

A major update that needs a code or config change is replaced by a pull request of its own that
makes both, as Next 16.4 was when its agent-files option replaced a `patch-package` patch.

## Design

core has no Figma file of its own. Its components and tokens come from haus, under the `core`
brand, so a visual change that haus should carry is made in haus. A pull request with a visual
change attaches before and after screenshots.

## Deployment

Vercel deploys [core.hipuku.dev](https://core.hipuku.dev) from `main` and a preview from every pull
request. [ARCHITECTURE.md § Deployment](./ARCHITECTURE.md#deployment) covers the region, the
database and what the demo switches off.

## Releases

core is deployed from `main` rather than released, so it has no tags yet. A release would be a
`chore/release-X-Y-Z` pull request that bumps `package.json`, then a `vX.Y.Z` tag on its merge commit
and a GitHub release from the tag, with notes grouped by label by `.github/release.yml`.
