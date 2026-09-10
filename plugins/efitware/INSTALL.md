# eFitware external AI preview

Use your own AI to design, record and review training. The plugin contains the eFitware skill and a remote MCP connection to `https://app.efitware.com/mcp/v1`. Your AI supplies the reasoning and renders its own charts. eFitware stores the records. The built-in Coach may be disabled and the eFitware app may be closed.

This is a preview, separate from an accepted public-directory listing. Tool availability follows the connected server; the package cannot grant access or enable unavailable tools. Current setup instructions are at https://www.efitware.com/ai.

## Claude (Desktop app and claude.ai)

1. Open Customize → Plugins → Add → Add marketplace → Add from a repository.
2. Pick `shinynet/efitware-marketplace` from the GitHub list (search for it if it is not shown) and click Sync. The dialog closes and the Discover tab switches to a view filtered to this marketplace, showing one eFitware card.
3. Click **Add** on that card. eFitware now appears under Plugins → Yours.
4. Open the eFitware plugin, then its **Connectors** tab. Click **Connect**, keep the pre-filled endpoint `https://app.efitware.com/mcp/v1` and the detected sign-in settings, click Add, then click Connect again and sign in to your eFitware account.
5. Start a new conversation and ask for your training context or your progress.

Until step 4 is done, a chat loads the eFitware skill but has no eFitware tools. If Claude says the connection is missing, do step 4; you do not need to reinstall the plugin. A notice may ask you to grant the Claude GitHub App access to the marketplace repository; that only enables automatic plugin updates and can be skipped.

## Codex Desktop

Add `https://www.efitware.com/marketplace.git` using the desktop Add marketplace control, or run `codex plugin marketplace add https://www.efitware.com/marketplace.git`. Select eFitware from that marketplace, install it and complete normal OAuth. Start a fresh task to load the skill. The CLI can also install with `codex plugin add efitware@efitware`.

The direct repository URL `https://github.com/shinynet/efitware-marketplace.git` is also supported. Choose one source for the `efitware` marketplace. Both sources use the same plugin identity; the website advances only after a compatible production deployment.

## Updates and removal

Refresh or upgrade the eFitware marketplace, install the available plugin update and verify its version. Codex CLI users can refresh with `codex plugin marketplace upgrade efitware`. Start a fresh conversation after updating. To remove the plugin, uninstall it in the client. Disconnect its account authorization separately in eFitware Settings → Connected AI clients; removing instruction files alone does not revoke access.

The ZIP archives are optional fallbacks for clients that support custom upload or local marketplaces. A Codex ZIP contains the same marketplace identity, `efitware`; register its extracted root only when using that fallback, rather than registering a second copy alongside the hosted marketplace. Prefer the hosted marketplace for ordinary setup and updates.

## Standalone skill or plain MCP

For a client with Agent Skills support, upload `efitware-coach.zip` or put its `efitware` directory in that client's supported skill location. (The archive keeps its original file name for compatibility with existing installers.) Configure the remote MCP endpoint separately and sign in normally. For a client without skills, connect only the endpoint: tool descriptions and schemas remain usable. Do not paste access tokens into the skill or plugin files.

## First use

Ask for your training context or recent workout history first. Then try a request such as “Draft next week's workouts using my equipment” or “Log these results in today's session.” A draft is not saved until you ask to save it and the server confirms the write. Dates and units follow your account; clarify ambiguous workout targets or measurements before recording them.

For saved workouts, the skill requests the branded interactive eFitware workout card by default in clients that support MCP Apps. Enter results and mark sets done in the card to save through your authenticated MCP connection. Other clients receive normal workout data and can log through the same tools. The MCP server hosts the card; the plugin supplies the connection and coaching skill. The package does not provide phone timers, voice or background reminders. Use the external client's own device features. Billing, account deletion, irreversible whole-history deletion, administration and another person's records are outside the MCP surface.
