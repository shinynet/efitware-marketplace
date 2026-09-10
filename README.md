# eFitware marketplace

![eFitware](apps/workout/theme/efitware-wordmark.svg)

Use your own AI to plan workouts, record results, and understand your training. This repository contains the official eFitware plugin and coaching skill, plus the branded interactive training views for clients supporting MCP Apps.

## Install

Follow [the eFitware setup page](https://www.efitware.com/ai), or add `https://github.com/shinynet/efitware-marketplace.git` as a marketplace in your AI client. Install **eFitware**, authenticate its remote MCP connection, and start a fresh conversation. No local Node.js installation is needed to use the plugin.

The stable website marketplace is `https://www.efitware.com/marketplace.git`. Choose one marketplace source. The plugin identity is `efitware@efitware` in both. Windows-local and Mac-remote tasks have separate host connections; authenticate on the host running the task.

See [client installation and removal](plugins/efitware/INSTALL.md), [privacy](https://app.efitware.com/privacy), and [terms](https://app.efitware.com/terms).

## Develop

Development requires Node.js 24, the pinned pnpm version, and the `zip` utility. Install dependencies with `pnpm install --frozen-lockfile`. Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test`.

The application owns authentication, permissions, MCP tools and persistence. The card sends authenticated tool requests through the host bridge; it has no separate database or API credentials. Both catalogs point at the committed plugin under `plugins/efitware`. All runtime assets are bundled, including fonts and brand artwork.

[Release and compatibility procedures](docs/releases.md) describe immutable artifacts, staging, production verification, promotion and rollback. `channels.json` identifies the advertised version. Program, schedule and calendar presentation is prepared in 0.1.9 after the template shell in 0.1.8. The advertised catalog stays on its verified version until the compatible application deployment is READY.

### Display coverage and editing

Cards open compact: wordmark, a link to the matching page in the application, an eyebrow, a title, up to three facts, an optional bar chart and one primary action, with "Show more" revealing the full view in the same iframe. The shared MCP App includes templates, programs, calendar, schedules, goals, phased plans, broad and focused progress, library/context, saved reviews, receipts, private share previews and status. `contract/view-coverage.json` classifies each tool and its final visual outcome. `interaction` separates direct card controls from host-mediated editing and supporting reads: an implemented outcome does not claim every field has an in-card form. Complex authoring stays with the user's AI, followed by a dedicated `open_*` result. Only display tools open cards; internal navigation reuses the current iframe.

Outcome cards can start/complete a session, correct external commentary and request supported undo, using canonical revisions and readback. Share controls prepare private content and copy captions; provider authorization/sync, portable archives, billing and whole-account/history deletion remain outside this UI.
