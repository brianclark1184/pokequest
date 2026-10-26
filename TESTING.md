# Validation record

## Quest reset update — October 24, 2026

- Added a separate **Start over** button and confirmation with **Keep our quest** focused by default. Confirmation clears finds, family details, and redemption and returns to welcome.
- All **10 Node logic tests passed**, including reset from a redeemed six-find quest, saved-state reload, memory-only reset, a second reset, fresh capture, and protection against stale cross-tab merges in both orders. Syntax checks passed for `app.js` and `tests/browser.js`.
- Direct Chrome checks on disposable local port 8877: cancelling retained 1/6 finds; confirming returned to welcome; a real tab reload retained welcome with an empty name and default 1 child; starting again through Gengar's QR collected only Gengar; resetting in a second tab returned both tabs to welcome.
- Added browser regressions for confirmation/cancel, clearing setup and notices, reload, replay, and cross-tab reset. The full iframe suite did **not** complete successfully in this run: iframe reload/navigation timed out. Its reset confirmation/cancel and clearing assertions passed before the reload timeout. The runner now refreshes cached HTML as well as scripts/styles and bounds reload waits. Prior full-suite results below predate this change.
- No production deployment or physical-phone verification was performed for this update. Reset intentionally clears prize status too, so a family may qualify again; prizes remain honor-based.

Tested October 24, 2026, in installed Google Chrome on Windows. Chrome reported version `156.0.0.0`. The browser connector exposed no session; the computer-use skill operated the installed Chrome UI directly.

## Results

- **Fly.io deployment verified October 24, 2026:** deployed the static app to `https://pokequest.fly.dev/`, with that address configured as the canonical QR host. Re-ran all 9 Node logic tests and the `app.js` syntax check successfully; Fly configuration validation passed. The production home page, direct Pikachu query, paper checklist, JavaScript, CSS, and all six WebP assets returned HTTP 200 with expected content types. Production `app.js` exactly matched the local file. HTTP redirects to HTTPS while retaining the query; development tests and `fly.toml` return 404. Fly's HTTP health check passed. Existing browser integration results below are from local testing; the browser suite was not rerun against production.
- **67 browser integration checks passed, 0 failed**, including the local Pokémon artwork update. Opened `http://127.0.0.1:8766/tests/browser.html` in Chrome, clicked Run, and inspected the displayed result through the native browser UI.
- **9 Node logic tests passed, 0 failed**, using `node --test tests/logic.test.cjs`. These include all 64 subsets of the six characters to verify the four-of-six threshold.
- JavaScript syntax checks passed for `app.js` and `tests/browser.js`.
- `node tools/qr-links.cjs https://quest.example.org/` generated six unique HTTPS links with the configured character IDs. This example is not a production domain.

The integration suite loads the actual HTML, CSS, and JavaScript inside Chrome frames. Test storage is isolated on port 8766 from the manual quest on port 8765; the suite restores its previous storage value afterward. No packages or browser libraries are required.

## Browser coverage

| Flow | Observed result |
| --- | --- |
| First visit | Welcome visible, default 1 child, choices bounded to 1–8 |
| QR before onboarding | Held through welcome and pre-Start reload; captured after Start |
| Team name | Saved and rendered as text, including angle brackets |
| Captures | All six IDs added once, arbitrary order; duplicates say Already found |
| Character artwork | Six same-origin transparent 320×320 images decode correctly; images fit their reserved area; found cards are full color, undiscovered cards muted; an intentionally missing file falls back to emoji without changing progress |
| Invalid parameters | Empty, zero, unknown, wrong case, and multiple parameters preserve progress and clear the query |
| Threshold | Three finds do not qualify; four do; remaining friends are optional |
| Family size | Setup count saved; pre-redemption edits update reward and volunteer display |
| Redemption | First tap only opens confirmation; cancel preserves eligibility; explicit confirmation persists and hides another claim |
| Later captures | Continue after redemption without changing prize status or child count |
| Reload and reopened app | Progress and redeemed state restored; capture message not replayed |
| Recovery | Fresh-state checklist restores finds; setup remains available; prior prizes can be restored; existing finds/redemption cannot be unchecked |
| Recovery during setup | Child count chosen before recovery stays selected |
| Corrupt storage | Broken JSON and unknown versions show guidance; invalid values sanitized, unknown IDs ignored, duplicates removed, counts clamped |
| Blocked storage | A throwing localStorage getter in a test frame models browser denial; visible warning, in-memory recovery, qualification, and redemption work |
| Two open quests | Concurrent discoveries merge, updates settle, both views agree, stale volunteer dialog closes on family edit, redemption locks both views |
| History | Returning with browser history to a cleaned query leaves progress intact |
| Responsive layout | At 320, 390, and 1280 CSS pixels: no Pokédex horizontal overflow; two/three card columns as appropriate |
| Dialog accessibility | Recovery fits a 320px frame; modal focuses inside, and cancellation returns focus to its trigger |
| Paper fallback | All six configured characters and their real artwork render; print control is present |

## Manual Chrome UI checks

Also operated the app directly at `http://127.0.0.1:8765/` using native clicks and keys:

1. Opened Pikachu's QR destination before setup, entered the test nickname “Pumpkin Patrol QA,” chose 3 children, and started. Confirmed Pikachu found, 1/6 progress, and query removal.
2. Navigated to Gengar's destination. Confirmed 2/6 and the previous family settings retained.
3. Opened recovery, checked Charmander and Bulbasaur, and restored. Confirmed 4/6 and 3 prizes for 3 children.
4. Visually inspected the reward and volunteer displays. Correct count and readable buttons were visible.
5. Opened prize confirmation, pressed Escape, and confirmed the reward remained unredeemed.
6. Reopened, explicitly confirmed the simulated redemption, and refreshed Chrome. “Prizes Collected” remained, 3 prizes for 3 children remained, and the second-claim control and child selector were absent.

The local manual test quest is intentionally left in this redeemed, four-found state; no real prizes were issued.

After replacing emoji with real Pokémon artwork, visually rechecked all six cards in Chrome. Four collected characters display in full color, with Squirtle and Zubat muted. Art occupies a fixed-height space above the names. Local transparent WebP assets total 98,776 bytes (about 99 KB); no external image host is used at runtime. Updated deployment instructions include the `assets/` folder.

## Bugs fixed during testing

- Restoring finds from welcome reset an already-selected child count. Welcome initializes its count once, so rendering recovery no longer overwrites the parent's selection.
- Concurrent tabs could exchange finds in different array orders and repeatedly rewrite localStorage. Cross-tab merges now use a stable configured ID order. The browser regression verifies both convergence and a bounded number of writes. Invalid or removed storage values from other tabs are ignored.

Early suite failures also exposed test-fixture issues: the simulated fresh browser initially left an old app frame alive, and programmatic button clicks initially omitted normal pointer/keyboard focus. Fixtures now destroy the old context before replacing storage and focus buttons before clicking.

## Remaining checks and tradeoffs

- No physical phone, camera, printed QR scan, outdoor lighting, venue connectivity, or real printer was available in this run. Confirm these using the README event-day checklist. Production HTTPS availability was subsequently verified as recorded above.
- Phone widths were tested as Chrome frame viewports, not physical iOS Safari or Android Chrome. Keyboard Escape was manually checked; a full screen-reader audit was not performed.
- The reopened-app test destroys and recreates the app frame; it does not close the user's entire Chrome session or test OS process recovery.
- Storage denial is simulated for the app frame without changing the user's browser privacy settings. Actual private-mode and embedded-browser behavior still needs device checks.
- History coverage checks the app's cleaned URL and retained state; physical camera-to-browser context switching still needs a phone.
- Collectibles, family size, recovery, and redemption deliberately remain honor-based. There is no offline caching; printed paper is the fallback.
- The production canonical URL is `https://pokequest.fly.dev/`. `node tools/qr-links.cjs` generates the six final destinations. Test actual printed codes before the event.
