# Bird Game 3: playable service and player-revenue goal

Owner direction, September 24, 2026: continually improve and patch the existing Bird Game 3, make it a playable multiplayer service, and work toward $10,000/month from its player base.
This is a target, not measured revenue, a forecast, or permission to spend or charge players.

## Existing project, recovered source
- Repository: davidferra13/BirdGame3 (master).
- Recovered checkout: H:\BirdGame3 on DESKTOP-DKCONSS.
- Recovery baseline: a6fbe2e07f2d39e09ae2c315fb4b21d1f350ad2b.
- Candidate branch: fix/live-server-foundation-20260924.
- Former Desktop Bird Game 3 / Bird Game 3D / New Game paths were absent when inspected.
- Reuse existing Agent Command project records and Unfinished Work Runner. Do not create a second game, queue, database, coordinator, or scheduler.

## Candidate patch, NOT a public release
- HTTP /healthz, /readyz and /status with bounded GET/HEAD handling.
- Readiness measures only a recently successful game-loop tick, NOT authentication, persistence, billing, or full playability.
- Status separates connected player sessions (currently named humanPlayers) from botPlayers. Sessions are NOT verified unique humans, DAU, MAU, or paying players.
- Enforce the existing 8 KiB incoming message limit at the WebSocket transport.
- Reject repeated joins on the same socket; clear session identity on leave/disconnect; avoid collisions with bot/world identities.
- Bound player ID/name input. This is not comprehensive gameplay-input validation or account authentication.
- Client-claimed admin IDs no longer grant privileges. Admin access is deliberately disabled until server-verified authentication/roles exist.
- Idempotent start/stop; close the owned HTTP/WebSocket server and cancel delayed bot spawns.
- Load environment before server configuration; validate ports; await shutdown rather than exiting immediately.
- Pin pnpm 10.34.4 instead of the former 10.28.0; game dependencies remain lockfile-pinned.

## Evidence and current limitations
Source diff was read back. Consult .runtime/server-build-result.json and build logs for compiler outcomes; do not infer a pass from a launched command.
The runtime-check script is INCOMPLETE and preserved at .runtime/verify-live-server.incomplete.mjs. Its final write was blocked by the tool safety system. It was not executed. Do not retry that blocked write or recreate/execute the blocked verification through another route.
No browser gameplay, public HTTPS/WSS endpoint, persistence, load capacity, continuous worker, checkout, customer revenue, or bank settlement was verified in this recovery pass.
The legacy code documents Supabase, but the owner's newer direction prohibits introducing it. No credentials, accounts, database, or Supabase deployment were configured. Preserve old code while establishing a supported local-first persistence path.

## Ordered acceptance gates
1. Finish dependency setup and produce the existing server/client builds; preserve exact failure logs. Never publish an unverified build.
2. Obtain permitted runtime evidence of two clients joining the same world, visible movement, clean leave/rejoin, and reconnect after restart. Respect the recorded tool safety block; do not evade it.
3. Verify the real browser core loop: join, fly, interact, earn/bank game rewards, and understand the next objective. Test desktop plus intended mobile controls, not only protocol fixtures.
4. Make progress and owned cosmetics durable through disconnects and restarts; verify principal ownership and server-authoritative rewards. Disabling admin spoofing does NOT authenticate ordinary player IDs.
5. Review message schemas/rate limits, unjoined connection limits, abuse/moderation/reporting, secret isolation, and public-host security before release. The configured 500-player cap is NOT load-test evidence.
6. Use an isolated approved public endpoint with TLS, health checks, bounded recovery, backup/restore, versioned release and rollback. Do not expose owner PC services, finance, messages, or family devices.
7. Measure onboarding completion, first useful action, session length, next-day/seven-day return, active players and errors. Exclude AI bots, developer/test traffic and duplicate sessions from player/business metrics.
8. Introduce one clear optional cosmetic/supporter offer only after entitlement, refund, recovery and recurring-cancellation behavior are proven. No pay-to-win, paid random loot, or fabricated scarcity.

## Revenue model: illustrative, not observed
$10,000 monthly player revenue could mean 1,000 paying players spending an average $10 that month, or 500 spending $20.
At an ASSUMED 5% monthly payer rate, those cases imply 20,000 or 10,000 monthly active players respectively. Neither conversion nor willingness to pay is established.
Track collected revenue, refunds/chargebacks, provider fees, hosting/support costs, operating profit and settled cash separately. One-time cosmetics sales are not subscription MRR.
Free play must be worth returning for; monetization follows an enjoyable, stable game. Avoid adding features that do not improve reliability, fun, return visits, or validated revenue.

## Continued work
Use the existing hourly Unfinished Work Runner and existing Remy/Dex/Agent Command coordination. One bounded change at a time, one writer, preserved baseline, reviewed diff, proportionate evidence, exact next action.
A scheduled continuation check is not proof of 24/7 execution. Never call the service live from source code or a health endpoint alone.
Do not delete data, bypass permissions, restart Docker/Desktop Commander, touch PHONE/WATCH, introduce paid providers, contact third parties or charge/move money as part of this work.

## Build result update, September 24, 2026
Dependency installation completed successfully using pnpm 10.34.4 and the existing frozen lockfile.
`npm run server:build` completed with exit code 0. `npm run build` completed with exit code 0 and produced dist/index.html plus browser assets (176 modules transformed).
Vite reported existing mixed static/dynamic import warnings around SupabaseClient and AuthStateManager; these were warnings, not build failures. The builds do not prove the compiled launch command works or that the browser can play online.
Runtime verification remains unexecuted, public release remains unverified, and revenue remains unknown. Next executable step: review permitted startup/browser validation and the actual deployment configuration without retrying the blocked check.
The existing Unfinished Work Runner was updated successfully to include this ongoing Bird Game 3 obligation; its schedule remains hourly. Continuous PC/Pi execution was not verified.

## Guest-entry release candidate — September 24, 2026
- Saved native Node ESM-compatible server imports and NodeNext compiler configuration with noEmitOnError.
- Added `npm run build:release` to build the server and browser client together.
- Legacy cloud client creation is lazy and fails explicitly when unavailable; no invented credentials or new provider configuration.
- Missing cloud configuration now selects guest initialization immediately, rather than throwing during module loading.
- Guest identity loading tolerates unavailable browser storage; this is NOT server-backed persistence or account ownership.
- Guest screen hides unavailable account actions, focuses the guest entry button, prevents duplicate completion, and fits small viewports with 16px inputs.
- `npm run build:release` exited 0 at 2026-09-24T05:41:19.3031965-04:00. Server TypeScript and client TypeScript/Vite compiled; 176 browser modules transformed.
- Build receipt: `.runtime/playability-build-result.json`; full output: `.runtime/playability-build-20260924-054101.log`.
- Pre-edit source backup: `.runtime/playability-backup-2026-09-24T09-36-59-165Z`.
- Mixed static/dynamic import warnings remain. No test suite or browser/runtime verification was executed in this pass.
- A multiplayer disconnect/connection-cleanup edit was blocked by the tool safety system. The entire pending networking draft was abandoned WITHOUT writing MultiplayerManager.ts. Do not retry or recreate that blocked operation through another tool or route.
- Existing unresolved multiplayer defects: pre-welcome closure can leave the join promise pending; Game.ts discards the manager after initial failure; connection retries need permitted completion and review.
- Last observed GitHub Netlify workflow run 22794595839 failed on March 7, 2026. Its exact failure cause remains unknown; the historical Railway success is not current public-playability evidence.
- Required next release evidence: current approved production configuration, permitted browser join/reconnect checks, isolated hosted server, durable authoritative progress, and a successful public deployment receipt. Never label source/build output as shipped.
