# Dulling completed/abandoned challenge cards

## Problem

`ChallengeCard` (`src/components/challenges/ChallengeApp.tsx:53-104`) renders every challenge — active,
completed, or abandoned — with identical visual weight (`border-white/8 bg-white/3 hover:border-white/15
hover:bg-white/5`). The only status signal is a small text badge. Finished challenges (successful or not)
compete visually with active ones instead of receding, making the Active section harder to scan.

## Design

Add `const isDull = isCompleted || isAbandoned` alongside the existing `isCompleted`/`isAbandoned`
booleans, and apply `opacity-55` to the card's outer `<button>` when `isDull` is true — the only change.

Opacity (not grayscale/desaturation) so the existing Completed (emerald) / Abandoned (red) badge colors
stay distinguishable at a glance; the whole card just recedes against the dark background. Hover state
(`hover:border-white/15 hover:bg-white/5`) is untouched and still fires on a dulled card, so finished
challenges remain visibly clickable. `notStarted` challenges are unaffected — they're upcoming, not
finished. No changes to `ChallengeDetail.tsx` or anywhere else; this is list-view only.

## Out of scope

- No change to badge colors, progress bar color, or any other visual element besides the card's overall opacity.
- No change to the `abandoned`/`completed` classification logic itself (`isChallengeExpired`, the
  `useEffect` that persists the `abandoned` status transition) — purely a rendering change.

## Testing

Manual verification in-browser: view the challenges list with at least one active, one completed, and one
abandoned challenge; confirm only the completed/abandoned cards are visually dimmed, badges are still
readable, and hover still works on dulled cards.
