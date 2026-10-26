# PokéQuest

A static, mobile-first trunk-or-treat quest. One family shares one browser quest, finds any four of six Pokémon, and receives one prize per child (1–8). No accounts, backend, remote assets, build step, or runtime dependencies.

## Local preview

From this folder, with Python installed:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/` in Chrome. Try `http://127.0.0.1:8765/?pokemon=pikachu` as a simulated camera QR link. Use HTTP only for local preview; printed event links must use HTTPS. Opening HTML files directly with `file://` is not a supported storage test.

## Deployment and configuration

Production address: **https://pokequest.fly.dev/**. The canonical URL in `app.js` is set to this address. Fly.io serves only the static app and local assets through Nginx; there is no application backend or database.

To deploy updates from this folder after `fly auth login`:

```powershell
node --test tests/logic.test.cjs
fly deploy --app pokequest --remote-only --ha=false
fly status --app pokequest
```

`Dockerfile`, `.dockerignore`, `nginx.conf`, and `fly.toml` define the deployment. Tests and project documentation are excluded from the image. HTTPS is enforced, pages revalidate on loading, and one small Machine remains running to avoid event-day cold starts. Fly.io compute/hosting charges may apply to the account; this deployment uses no paid add-on services. Run `fly scale count 0 --app pokequest` after the event to stop the Machine (future requests can start it again while auto-start is enabled).

The simplest deployment is a static host's folder upload. Upload `index.html`, `styles.css`, `app.js`, `paper.html`, and the complete `assets/` folder together, preserving their names and directory structure. No build command or server application is needed. Serve `index.html` at the site root over HTTPS. Do not deploy the development `tests/` directory.

Choose the final HTTPS address before making signs. In the small configuration block at the top of `app.js`, set `canonicalUrl` to that address, including its trailing slash. The same block holds all six characters (`id`, `displayName`, `emojiOrArt`, `fallbackEmoji`, optional `hint`, and card color). `emojiOrArt` can be a local path under `assets/` or an emoji. Keep IDs stable once printed. The canonical setting generates QR destinations; it does not redirect families or move their saved browser data.

The cards, recovery checklist, and paper backup use local Pokémon artwork. Undiscovered cards show a muted image; found cards show full color. Six transparent WebP files are bundled, so there are no image-service requests during the event. Missing images fall back to emoji and names remain visible. Artwork provenance is recorded in `assets/pokemon/SOURCES.md`.

An existing free static host is also sufficient. Verify that both the root URL and a URL with `?pokemon=pikachu` load directly without redirects to a different hostname. Keep every QR on the exact same HTTPS origin and path, including consistent `www` usage.

## QR destinations and printing

For Rollo roll-label printing, use `output/pdf/pokequest-qr-labels-100x150mm.pdf`: seven portrait pages, each exactly **100 × 150 mm**, with one QR per label (welcome, Pikachu, Gengar, Charmander, Bulbasaur, Squirtle, Zubat). Select **100 × 150 mm** paper in the printer settings and **Actual size / 100%**, with one page per label; turn off Fit / Shrink and multiple-pages-per-sheet. The codes are black on white with their original quiet zones. Print one label first and check it with a phone camera before printing the full set. Exact millimeter sizing matters: 4 × 6 inches is a slightly different size.

Regenerate with `python tools/create-qr-labels.py` (authoring dependencies: `reportlab`, `Pillow`, `PyMuPDF`, `zxing-cpp`, plus Node to read the app configuration). It uses the seven local QR images, checks their destinations against `app.js`, and verifies all seven codes again from rendered PDF pages at 200 dpi. It fails if the config changes without matching QR images. Review PNGs are written under `tmp/pdfs/`. Physical Rollo output and phone-camera scans remain to be checked.

The family introduction flyer is ready at `output/pdf/pokequest-family-flyer.pdf`, with a PNG preview beside it. Print on US Letter (8.5 × 11 inches), portrait, at actual size / 100%. It uses the supplied `assets/qr/qr-pokequest.png` start code, three simple steps, and the six local character images. Place copies at welcome and around the event. Test a printed copy with a phone camera before posting. The PDF has been rendered and visually checked for a single-page layout; physical print scanning still needs an event-day check.

To revise and regenerate the flyer, edit `tools/create-flyer.py` and run `python tools/create-flyer.py` (authoring dependencies: `reportlab`, `Pillow`, and `PyMuPDF`; these are not app dependencies). If the production address changes, replace the start QR image and update the flyer's printed address and PDF link before regenerating. App deployment instructions above are unchanged; the flyer can be printed directly from the PDF.

With Node installed, list the six destinations from the actual character configuration:

```powershell
node tools/qr-links.cjs
```

Or preview links before setting the config:

```powershell
node tools/qr-links.cjs https://quest.example.org/
```

For the default set, append these queries to your canonical address:

| Sign | Query |
| --- | --- |
| Pikachu | `?pokemon=pikachu` |
| Gengar | `?pokemon=gengar` |
| Charmander | `?pokemon=charmander` |
| Bulbasaur | `?pokemon=bulbasaur` |
| Squirtle | `?pokemon=squirtle` |
| Zubat | `?pokemon=zubat` |

Encode each complete generated HTTPS URL with a static QR generator or your browser's page-sharing QR feature. Save the resulting image locally. No QR generation service is called by the app, and there is no in-app scanner. Print a high-contrast black-on-white code with a clear white border, a large character name, and “Open your Camera, scan, then tap the link.” Start with codes at least 2 inches wide and enlarge for viewing distance. Put no artwork over the code. Test the **actual printed signs** using normal iPhone and Android cameras at the event's likely lighting and distance. Do not print localhost, the example domain, short-lived preview addresses, or a generator's own landing-page URL.

## Recovery and volunteer guidance

To play again, tap **Start over** below the recovery help, then **Yes, start over**. **Keep our quest** cancels. Confirmation clears finds, team name, child count, and prize status and returns to welcome. This also resets other open quest tabs in the same browser. Reset is permanent and honor-based; it allows earning prizes again. No QR signs need changing.

Families should open scans in the same browser. Different browsers and in-app browsers can have separate storage, even on one phone. “Missing your Pokémon?” restores found characters with a checklist. It is available on welcome and the Pokédex. Existing finds cannot be unchecked. Families who already received prizes should also check “We already received our prizes.” If recovering before Start, finish family setup afterward.

After four finds, the reward screen directs families back to the Pokémon Trunk to collect their prizes. At the trunk, choose “Show volunteer.” The volunteer verifies the visible family prize count, hands out one prize per child, taps “Prizes Collected,” and confirms. “Not yet” safely cancels. Confirmed redemption stays saved; the child count locks and the claim button disappears. Finding the last two characters remains possible.

If saving is blocked, an obvious warning appears and the current page keeps progress in memory. A later scan, refresh, or closing the page may require manual recovery again. If internet access fails, offer the paper checklist instead of troubleshooting phones.

Open `paper.html` and use “Print checklist” to prepare paper backups. Families check any four friends and fill in child count. Volunteers record prizes collected after handout. Keep a stack at welcome and at the Pokémon Trunk.

## Tests

No packages need installing. Run lightweight logic checks with Node:

```powershell
node --test tests/logic.test.cjs
```

For repeatable browser integration checks, start a **separate** preview origin:

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/tests/browser.html` in Chrome and click “Run all browser tests.” This exercises the real app in same-origin frames: onboarding and held QR, six captures, duplicates and invalid queries, threshold qualification, prize counts, confirm/cancel, reload and reopened page, recovery, corrupted and unavailable storage, history, phone widths, focus, and paper backup. The suite temporarily replaces only its origin's `pokequest-v1` state, then restores it. Run it without other app tabs on **that test origin**; leave family testing on port 8765 separate.

See `TESTING.md` for observed results and remaining device checks.

## Five-minute event-day smoke test

1. On a fresh browser, scan one printed QR. Verify welcome, choose 3 children, press Start, and check the scanned friend is found. Reload: the same friend remains, with no repeated capture notice.
2. Scan the same sign twice: count stays 1. Scan two different signs: 3 finds must not unlock prizes. Scan a fourth: reward shows 3 prizes for 3 children.
3. Change child count to 2. Show volunteer: 2 prizes. Tap “Prizes Collected,” cancel with “Not yet,” then repeat and confirm after a pretend handout. Reload: “Prizes Collected” remains, with 2 children and no second claim button.
4. Scan the last two signs. Collection reaches 6 and prizes stay marked collected.
5. In another browser, restore four finds with “Missing your Pokémon?” Check the prior-prizes box when appropriate and finish family setup. Confirm the result. Check paper copies and test a second phone platform.

Use disposable test quests; do not test by claiming again with an actual family's redeemed page.

## Deliberate tradeoffs

- Captures, child count, recovery, and redemption are honor-based. Guests can self-report or edit local data. There is no secure prize verification.
- Progress belongs to a browser origin/profile, not a device or account. Clearing browser data, changing hosts, private-mode closure, or switching browsers can lose it. Recovery includes self-reporting prior prize collection.
- There is no offline cache or service worker. New page loads need connectivity; the paper checklist is the event fallback.
- Character artwork is bundled locally, per the organizer's request. Emoji fallbacks vary by platform. This is an unofficial community event project.
- A browser test cannot prove printed-code readability, outdoor contrast on every device, mobile browser storage behavior, or network quality at the venue. Test printed signs on physical phones before opening.
