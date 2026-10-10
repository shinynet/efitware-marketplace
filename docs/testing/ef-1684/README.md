# EF-1684 cardio added-weight client qualification

The minimum producer is app merge `d090b55dc33b578b615c986e43e8d2e75d2ba0ba`, verified serving READY as `dpl_8vstxxmjSiarW4yyePj9uJgzwCEZ`. EF-1681 production acceptance separately confirms same-exercise vest/pack history ceilings and a higher explicit user edit. This public repository contains only synthetic consumer fixtures and client artifacts, never account history or application source.

## Regressions and verification

The first six cardio consumer tests failed against the shipped card: it used the strength field label and body-weight-only hint, displayed absent/zero cardio targets as body weight, and omitted the input on a planned-load payload without tracking load shape. Those cases now pass. Eight new tests also verify supplied lb/kg measurements in English/German, compact/template extra-load semantics, quiet zero targets, explicit +40 lb edits and null clearing. Existing strength presentation stays covered.

Full build, typecheck, lint and tests pass: **25 files / 211 tests**, exit 0. Two independent production card builds match SHA-256 `ed3a67b8ab38af6829c4961bcc315de759db42451e4cdcda5fb956df1f5769b8`. The bundled card is 992,054 bytes, below its 1,500,000-byte ceiling. Generated wire schemas are unchanged; modality already belongs to the workout exercise.

## Actual browser qualification

A local HTTP host rendered the actual bundled `dist/card/workout.html` in an iframe using the public MCP Apps JSON-RPC initialization and tool-result notifications. No account, authentication seam or production write was involved. The synthetic fixture has Outdoor Run with a ten-minute target and a total extra-load measurement. The real WorkoutApp caller passes the exercise's modality to the real row.

All **24 Chromium cases** pass: 320/390/1280 px × light/dark × English/German × lb/kg. The expanded input has its localized Added label and none hint, receives keyboard focus and has no horizontal overflow or application errors. There are zero external runtime requests. One imperial case enters 40 in the actual field; the SDK bridge emits one `log_sets` measurement `{ value: 40, unit: 'lb' }`, performs readback and displays 40. This is browser/bridge evidence, not production persistence.

Eight 390 px screenshots are beside this record; `browser-results.json` lists the full matrix. The temporary local host and isolated browser were stopped after success. Initial harness attempts had a malformed mocked initialization response and accidentally collapsed the already-open exercise; neither is claimed as product failure or passing evidence.

## Release completion

The immutable 0.1.34 release, both real SDK app bridges, reviewed app pin, exact compatible serving READY, independently approved promotion and metadata-only publication are complete. The public channel now advertises 0.1.34. [Release history](../../releases.md) records the immutable source, manifest, app and website merges and serving deployments. All 27 asset identities match the staged receipt after publication. Website production passed two fresh literal HTTP/2 clones and a fast-forward upgrade from 0.1.33, including full fsck, both plugin identities and the skill hash. Actual external Desktop activation or authentication continuity remains outside these evidence claims.
