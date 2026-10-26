# Codex project instructions

Read `SPEC.md` before implementing anything. Treat its fixed decisions and acceptance criteria as authoritative.

## Priorities, in order
1. Reliability for a one-day church event with limited testing.
2. Fast, simple mobile experience for busy families.
3. Recoverability without volunteer troubleshooting.
4. Pleasant visual design and subtle fun.

## Guardrails
- Do NOT add a backend, database, login, account system, API, cloud storage, session tokens, QR scanner library, GPS, analytics, external image dependency, or staff authentication.
- Prefer a few understandable static files: `index.html`, `styles.css`, `app.js`, plus optional local assets.
- Keep all collectible definitions in one editable configuration area.
- Use native camera QR → HTTPS URL links only.
- `localStorage` is a convenience, not a security boundary. Handle read/write failures gracefully.
- Never allow decorative features to break core capture, progress, or redemption.
- Minimize dependencies and configuration steps.
- Keep UI copy short, clear, child/family-friendly, and readable outdoors.
- Test state transitions and browser reload behavior; document what was tested and any remaining risks.

## Execution method
1. Inspect repo and read SPEC.md.
2. Give a brief implementation plan only; then build the working app end-to-end.
3. Run available tests and verify key flows.
4. Update README with deploy and QR printing instructions.
5. Summarize files changed, validation performed, and known limitations.
