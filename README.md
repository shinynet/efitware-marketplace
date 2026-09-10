# eFitware marketplace

![eFitware](apps/workout/theme/efitware-wordmark.svg)

Use your own AI to plan workouts, record results, and understand your training. This repository contains the official eFitware plugin and coaching skill, plus the branded interactive workout card for clients supporting MCP Apps.

## Install

Follow [the eFitware setup page](https://www.efitware.com/ai), or add `https://github.com/shinynet/efitware-marketplace.git` as a marketplace in your AI client. Install **eFitware**, authenticate its remote MCP connection, and start a fresh conversation. No local Node.js installation is needed to use the plugin.

The stable website marketplace is `https://www.efitware.com/marketplace.git`. Choose one marketplace source. The plugin identity is `efitware@efitware` in both. Windows-local and Mac-remote tasks have separate host connections; authenticate on the host running the task.

See [client installation and removal](plugins/efitware/INSTALL.md), [privacy](https://app.efitware.com/privacy), and [terms](https://app.efitware.com/terms).

## Develop

Development requires Node.js 24, the pinned pnpm version, and the `zip` utility. Install dependencies with `pnpm install --frozen-lockfile`. Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test`.

The application owns authentication, permissions, MCP tools and persistence. The card sends authenticated tool requests through the host bridge; it has no separate database or API credentials. Both catalogs point at the committed plugin under `plugins/efitware`. All runtime assets are bundled, including fonts and brand artwork.

[Release and compatibility procedures](docs/releases.md) describe immutable artifacts, staging, production verification, promotion and rollback. `channels.json` identifies the advertised version. The initial extracted catalog preserves version 0.1.6; the first staged artifact release will be 0.1.7.
