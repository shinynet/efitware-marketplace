# Releases and compatibility

The application owns its product DTOs, MCP tools, authentication, permissions and database. This repository owns the plugin, coaching instructions, embedded training views, and the card's consumer projection. No source import crosses that boundary.

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


## Shared training shell (0.1.8)

The single bundle serves `ui://efitware/app-v1.html` and the compatible `ui://efitware/workout-v1.html`. Dedicated `open_*` tools create host cards; in-card navigation uses `app.callServerTool` and replaces the view inside the existing iframe. Ordinary background reads and supporting mutations have no UI binding.

`open_template` returns `{ view: "template", record, related: { exercises }, presentation }`. The legacy `open_workout` result stays `{ workout, exercises, presentation }` and is normalized by the shell. Templates contain planned prescriptions without session actuals. Creating a dated workout requires an explicit date; retries preserve the same idempotency key and arguments, and a failed readback never repeats a completed creation. Returning to a template asks before discarding unsaved set results. Controls call the bridge directly: the standard iframe sandbox permits scripts but may block native form submission.

The template's AI action checks `message.text` capability before `app.sendMessage`, with a 15-second timeout. Accepted messages are not persistence confirmations. Unsupported, refused or uncertain delivery leaves editable request text; uncertain delivery asks the user to check chat before retrying.

Manifest format 2 adds `contract/template-view.schema.json` and `contract/view-coverage.json` to the exact asset inventory. Earlier manifests without a format field retain their original inventory for rollback. The coverage registry classifies every server tool by role and implementation state; the application compares it with real `tools/list` annotations. At 0.1.8, program, goal, progress, library and remaining account views were planned; later slices below extend that coverage.

Both schema projections use draft-07 input semantics, preserve additive product fields at the application boundary, and share valid/invalid compatibility fixtures. The entire inline HTML must be at most 1,500,000 UTF-8 bytes; no runtime CDN dependency is allowed.

## Planning views (0.1.9)

The shared shell adds `open_program`, `open_schedule` and `open_calendar`. Program membership tabs use canonical collection metadata and explicit paging; schedule pause/resume and program archive/reactivate use the current revision. Archiving never implies schedule pause. Calendar selection is read-only; occurrences require a labelled create-and-open action, with one saved workout per schedule/date. Back navigation retains the prior view parameters and guards unsaved workout results.

New views use the same `{view,record,related,presentation}` envelope with account `timeZone`. Calendar day formatting stays independent of time-zone offsets; only real timestamps use that zone. Human recurrence phrases reuse the product parser and vocabulary with provenance and shared fixtures. The calendar fixture set includes daylight-saving boundaries and leap day.

Manifest format 3 adds `program-view.schema.json`, `schedule-view.schema.json` and `calendar-view.schema.json` under `contract/`. Earlier format inventories remain supported by the app for rollback. This slice has no CDN, migration or separate credentials. The stage, compatible app READY and catalog promotion gates remain unchanged.

## Goal and goal-plan views (0.1.10)

`open_goal` displays stated targets, linked programs/plans and paginated dated observations. Check-in creation, explicit goal status, manual-plan lifecycle and version activation reuse the server's revision/idempotency policies. A goal revision covers root fields, not independently changing observations. Confirmation after a recovered read also clears the saved check-in draft; ambiguous writes keep the exact original intent for retry.

`open_goal_plan` preserves active content on every history page and separates displayed version from active version. Historical selection verifies its parent plan and never mutates. Phase dates, milestones and author feasibility assessments do not imply completion. Retained phase IDs may be non-database stable strings. Program references preserve a removed-record state. Actual authorship, changes and no-change reviews remain visible. Coach management needs explicit takeover through the host AI workflow; the card cannot silently take over.

Format 4 adds the goal and goal-plan input schemas; all prior exact inventories remain supported for rollback. The shared follow-up component owns message capability, timeout and editable fallback across templates/goals/plans. The coverage matrix now has seven display tools (workout, template, program, schedule, calendar, goal, goal-plan); progress/library/context and remaining status/share/undo coverage stays planned.

## Progress views (0.1.11)

General progress, a specific exercise and a specific body measurement have dedicated display tools: `open_progress`, `open_exercise_progress`, `open_body_metric`. The last two answer focused questions directly rather than starting at the overview. Exact exercise identity is resolved before comparison; ambiguous variants are not combined. Strength estimates remain distinct from actual sets, and locked estimates do not hide recorded sessions. All-time exercise statistics are labelled separately from selected-range data.

Native SVG charts place observations at their real calendar-day spacing and expose exact dated values through a keyboard-accessible selector. Straight segments connect observed points only; no synthesized observations, smoothing or trend prediction. Zero-filled canonical weekly buckets use zero-based bars. Measurement direction is neutral and units convert at presentation. Range/section/pagination and source-workout navigation stay in the same iframe; measurement range controls work in a host sandbox without form-submission permission.

Format 5 adds the three progress input schemas while retaining earlier inventories for rollback. The coverage registry has 108 tools including ten display tools. Library/context and remaining status/share/undo coverage remains planned. The card still bundles its own theme, fonts, Vue and bridge without a CDN, below the existing byte ceiling.

## Library and context release

0.1.12 adds library, exercise, training-context and memory views in format 6. Template exercise names navigate to their supporting definitions; no extra cards are opened for incidental creation. Simple controls use existing MCP mutations with readback and original retry intent; memory corrections carry the current revision. Complex changes use the host follow-up explicitly. The copied context vocabulary records its source commit and projection in PROVENANCE.json. Previous manifest inventories remain supported for rollback.

## Setup guidance and naming (0.1.14)

The skill is now `efitware` (directory `plugins/efitware/skills/efitware`, display name "eFitware"); the standalone archive keeps the file name `efitware-coach.zip` so every published inventory format stays valid, but it now extracts to `efitware/`. Consumers that read the skill out of the archive must accept both entry paths across releases. The Claude catalog entry carries `displayName`, `author`, `homepage` and `keywords` so hosts render "eFitware" rather than a capitalised identifier.

INSTALL.md, the skill's Connecting section and the Codex listing copy describe the observed Claude flow: after Sync the Discover tab is filtered to the marketplace and the card needs an explicit Add, and the server is connected from the plugin's Connectors tab (Connect → Add → Connect → sign in), without which a chat has the skill but no tools. The skill tells the model to say exactly that instead of claiming the plugin is missing.

No tool inventory, schema or card change; `minimumAppCommit` is unchanged.
