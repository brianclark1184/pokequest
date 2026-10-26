# PokéQuest — Trunk-or-Treat Scavenger Hunt

## Goal
Build a delightful but extremely reliable, mobile-first, one-day QR scavenger hunt for a church trunk-or-treat. Prioritize simplicity and recoverability over security or anti-cheating. The event has little time for pre-event testing.

## Fixed decisions
- One **shared quest per family device**, not separate child accounts.
- Six unique Pokémon-inspired collectibles, each found by scanning a printed QR code on a trunk, decoration, or volunteer.
- Collecting **any four of the six unique** collectibles unlocks the reward screen. Families can still collect the last two.
- Family sets a **number of children**; the reward screen displays that many prizes (one per child).
- The volunteer hands out prizes and taps **Prizes Collected** on the family's phone. This is honor-system redemption, not secure verification.
- **No authentication, backend, database, server-side sessions, staff portal, analytics, GPS, leaderboard, or paid services.**
- Use `localStorage` to persist progress, child count, team name, and redeemed state. Do not use personal information.
- A parent must be able to recover manually if localStorage is lost or another browser opens: an obvious **Missing your Pokémon?** action permits checking the found characters. This is intentionally honor-based.
- All QR URLs use the same canonical HTTPS host, and normal phone-camera QR scanning (no in-app scanner).
- Deploy as a static website. Prefer plain HTML, CSS, and JavaScript with no dependencies/build step unless there's a compelling reason otherwise.

## Required UX
1. **Entry/first visit:** friendly welcome; optional team name; children count (default 1, bounded 1–8); prominent Start button. If URL contains a Pokémon parameter, preserve it through onboarding and collect after Start.
2. **Pokédex:** six large collectible cards; undiscovered state versus discovered state; count and progress toward 4; indication that the last two are optional after qualification. Always-visible instructions for scanning using the native camera. Show child count and allow adjusting it before prize collection.
3. **Capture:** each unique QR URL opens the app and unlocks exactly that item; show a friendly confirmation. Repeated scans are harmless and should say Already found. Invalid identifiers show a non-scary error and return to the Pokédex.
4. **Qualified reward:** after any four distinct collectibles, show a clear celebratory reward screen saying `X prizes` for `X children`, and a prominent **Show volunteer** view. Provide a confirmation step before marking the prizes collected.
5. **Redeemed:** saved locally, clearly displays `Prizes Collected`; retains captured Pokémon and progress. Do not allow an accidental second redemption by normal navigation. Since this is honor-based, manual recovery/reset may exist but should be visibly separate.
6. **Recovery:** obvious Missing your Pokémon? → six-item manual checklist to restore discoveries; explain that different browsers don't share progress. Make this usable without staff assistance.
7. **Emergency fallback:** simple printable paper checklist / clear backup guidance for event volunteers (can be a lightweight extra HTML view or a documentation section).

## Pokémon configuration
- Make all six characters configurable in one small data array with `id`, `displayName`, `emojiOrArt`, and optional `hint`.
- Default set: Pikachu, Gengar, Charmander, Bulbasaur, Squirtle, Zubat. Per the event organizer's October 24, 2026 request, use recognizable Pokémon artwork bundled as optimized local assets, with emoji fallbacks if images cannot load. Do not hotlink artwork or require an external image host at runtime.
- URL format: `https://<canonical-host>/?pokemon=<id>`; generate the six final QR destinations from config after the production domain is known.
- It must be impossible for merely changing the URL to corrupt existing progress; duplicates deduplicated by ID.

## Storage contract
Single versioned localStorage state object, e.g. `pokequest-v1`:
```json
{
  "version": 1,
  "teamName": "Ghost Hunters",
  "childCount": 3,
  "collected": ["pikachu", "gengar"],
  "redeemed": false
}
```
Validate and sanitize saved values on load: unknown IDs ignored, duplicate IDs removed, childCount clamped 1–8, invalid data handled gracefully. If storage is unavailable, keep state in memory and visibly warn that progress may not survive closing the browser; recovery remains available.

## Operational edge cases
- Scan collectible before onboarding: hold the parameter until setup finishes, then collect.
- Visiting another collectible URL in the same browser restores state and adds the new collectible.
- Reloading an identical QR URL never increases count.
- Don't repeatedly replay a capture pop-up on every refresh of the same query parameter; clear or replace the URL after processing via history.replaceState.
- Closing/reopening resumes progress in the same browser.
- iOS/Android in-app browser or different browser may isolate localStorage. Offer manual recovery prominently.
- A family can modify child count before redemption; after redeemed do not silently increase the claimed prize count.
- Zero or invalid QR values must not unlock collectibles.
- Reward remains earned after 4 even if more are later discovered.
- Scanned Pokémon should be added even if already qualified or already redeemed (collection continues), but prize status stays redeemed.

## Accessibility and performance
- Large touch targets; responsive for narrow phones; strong contrast; semantic elements; keyboard functionality; reduced-motion preference respected.
- No remote assets necessary for core functionality; fast static loading on weak mobile signal. Consider avoiding service workers and complex offline caches to reduce bugs.
- No form validation loops, blocking permission prompts, camera APIs, or install requirements.

## Test checklist (must complete)
- First-visit welcome; child count editing.
- Direct QR URL before Start retains capture.
- All six QR IDs collect once, in any order.
- Duplicate scan does not increment.
- Four unique items unlock rewards; three do not.
- X children yields X prizes; child count editable until redemption.
- Redemption confirmation and persistent redeemed status after refresh.
- Manual recovery restores intended collected items.
- Corrupted and unavailable localStorage don't crash the site.
- Query parameter cleared after processing; browser back does not cause unexpected reset.
- Works on small mobile widths and standard desktop browser.

## Deliverables
- Working static application files.
- `README.md` with local preview instructions, easiest static deployment path, how to set the canonical production URL, QR URL list/generation/printing, recovery guidance, and 5-minute event-day smoke test.
- At least lightweight automated logic tests if useful without introducing heavy dependencies.
- Explicitly document known tradeoffs: a guest can self-report captures and child count; saved progress is per browser, not per device; redeemed status is honor-based; event can fall back to paper.

## Acceptance criterion
A parent can use a standard phone camera to scan any four out of six printed QR codes, watch progress update, see the correct family prize count, show it to a volunteer, mark collected, and resume the result after refresh—all without creating any account or requiring backend services. If browser context changes, parent can restore collected items in a few taps.
