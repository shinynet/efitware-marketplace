# Releases and compatibility

The application owns its product DTOs, MCP tools, authentication, permissions and database. This repository owns the plugin, coaching instructions, embedded workout card, and the card's consumer projection. No source import crosses that boundary.

`apps/workout/lib/PROVENANCE.json` records the source commit/hash and copied-file hash for extracted helpers and theme assets. The hashes document intentional copying. `contract/compat-fixtures.json` independently checks behavior in both repositories: root section order, nested set/activity slots, stable ties, unit thresholds, formatting, and localized input round-trips. Updating a copy requires updating provenance and reviewing the behavioral fixtures.

`pnpm build` bundles Vue, fonts, brand assets and theme tokens into `dist/card/workout.html`, then generates the open draft-07 input schema. The product validates its raw tool output against that schema using Ajv without stripping extra fields, applying defaults or coercing types. The product DTO remains authoritative.

## Stage

1. Prepare a reviewed release branch. Bump both plugin manifest versions together. Keep `main` on its published catalog version while staging.
2. Build and verify with `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Confirm two card builds have identical SHA-256 values.
3. Push an annotated `v<version>` tag at the reviewed release commit. The stage workflow checks tag/version agreement and publishes the complete asset set as a prerelease. GitHub locks the tag and assets at publication. Fix mistakes in a new version.
4. Record the manifest SHA-256. Its file entries contain logical paths, exact byte counts/hashes and GitHub asset filenames. GitHub assets have flat names: `contract/workout-view.schema.json` is downloaded as `workout-view.schema.json`, then installed at its logical path.

The local equivalent is `pnpm release:build --output <new-directory> --strict` after building from a clean commit. It refuses an existing destination. ZIP entry timestamps and ordering are fixed for reproducibility. The explicit packaging allowlist never includes repository history or environment files.

## Verify and promote

1. Pin the staged tag and manifest hash in `efitware-app`'s `efitware-marketplace.lock.json`.
2. Run the application's contract fixtures and real tool/resource checks for both SDK generations. Verify the deployed application provides every tool in `serverContract`, and its production deployment reaches READY.
3. Merge the release branch into `main` using a merge commit or fast-forward. Never squash or rebase: the tagged commit must remain an ancestor of `main`. Update both catalogs, both plugin manifests and `channels.json` together, setting `published` to the verified version and `staged` to null.
4. Clear the GitHub prerelease flag. Download the manifest again and compare its SHA-256 with the staged value. No release asset changes during promotion.
5. Advance the website's pinned static mirror only after compatible application deployment. Verify plain HTTP cloning and existing-client upgrade through the same marketplace URL.

## Roll back

Restore the application's previous lock file and deploy it. Add a new `main` commit restoring the previous catalog/plugin versions and channel; never rewrite published Git history. Repoint the website mirror pin atomically with its metadata. Previous immutable artifacts remain available. For the initial extraction, the pre-extraction app commit and its unchanged 0.1.1–0.1.6 downloads remain the rollback baseline.

Automated bridge tests do not establish Desktop rendering or authentication continuity. Record fresh installation, existing-install upgrade, rollback, and preserved authentication in actual clients, including the separate Windows-local and Mac-remote host cases.
