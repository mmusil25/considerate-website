# Session status — Jul 17, 2026

One feature shipped: LinkedIn badge on the homepage (commit 8708eab, deployed,
verified live on www + apex).

## LinkedIn badge with fallback (commit 8708eab)
Mark asked for LinkedIn's official profile badge embed on the front page.
Finding: **LinkedIn's badge service is effectively broken for anonymous
visitors.** `platform.linkedin.com/badges/js/profile.js` loads and injects a
request to `badges.linkedin.com/profile?...`, but that endpoint answers with
LinkedIn's HTTP 999 anti-bot page (content-type text/html), which Chrome then
ORB-blocks (`ERR_BLOCKED_BY_ORB`) — no iframe, badge stays blank. Reproduced
in a bare HTML file with LinkedIn's exact snippet, and in Mark's own browser.
Not fixable from our side.

Solution (Mark chose "official + fallback"):
- `(frontend)/components/LinkedInBadge.tsx` — client component that renders
  the official badge markup + script, watches (MutationObserver + 5s timeout)
  for the iframe LinkedIn should inject, and swaps in a styled lookalike card
  (white card, #0A66C2 top strip, circular /Mark.jpg, name, "View profile"
  button with LinkedIn logo) when the iframe never arrives. If LinkedIn ever
  unblocks, the real badge shows automatically.
- Homepage: h2 "Reach out to me on LinkedIn" (16px version of the site's
  uppercase blue section-heading style) + centered badge between the portrait
  and Selected Work.
- Known cosmetic quirk: ~5s where only the fallback's plain "Mark Musil" text
  link shows before the card pops in. Mark saw the behavior and approved;
  timeout is trivially tunable in LinkedInBadge.tsx.

## Deploy
- scripts/deploy.sh EXIT=0 (build → push → migrate gate OK → service stable).
- CloudFront invalidation `/*` on E39MAQBKX9JXY9 completed.
- Verified live: badge markup + heading in served HTML on both hosts; fallback
  card renders in a real browser on www.
- Pushed main to origin this session (was several commits ahead since Jun 11).

## Open follow-ups (carried)
- Continue site-wide top-tier reframe: /about copy (~line 153 self-deprecating
  framing), /services.
- Prod admin Cache screen click-through (still not exercised in prod UI).
- SES production access, analytics account, prod media empty-alt backfill,
  turnkey-template refactor backlog.
