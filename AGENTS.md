# eFitware marketplace agent instructions

Use dedicated ticket worktrees for implementation and verification. Use local git for commits and pushes, the connected GitHub app for hosted operations, and TWG for Jira. Open a ready PR when verification is complete; the implementor watches independent reviews, addresses feedback, merges after approval, verifies publication, and cleans up their worktree.

This is public client code. Never copy private application history, environment files, credentials, or server internals. Keep the MCP server and product data ownership in efitware-app. Do not import sibling repository source. Record provenance for deliberate copies and verify shared behavior with the versioned contract fixtures.

Use strict TypeScript, focused Vue components, semantic accessible markup, English and German copy, locale-aware formatting, and copied eFitware theme tokens. Bundle the card and all assets without runtime CDN requests. Preserve plugin identity and production MCP URL.

Release assets and tags are immutable. Stage releases before compatible production verification. Promote via merge commit or fast-forward only: never squash or rebase a tagged release branch. Catalog state belongs in channels.json; it never modifies a published manifest.
