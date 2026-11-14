# Session handoff - 2026-11-12: Considerate Home Repair (handyman division)

Branch `handyman` (uncommitted work). NOT live: the public site is unchanged.

- New pages are generated: `static-site/src/build.py` (+ `site.css`, `quote.js`) writes
  `public/index.html` (two-door homepage), `/engineering`, `/handyman`, 5 service pages,
  `/handyman/pricing`, `/handyman/realtors-landlords`, `/handyman/quote`, 8 neighborhood pages,
  `sitemap.xml`, `robots.txt`. Business facts live in `CONFIG` in build.py. Never hand-edit the output.
- Legacy Next export pages (/services, /projects, /about, /contact) untouched.
- `public/og-image.jpg` was missing from the live site (404 for share previews); restored from app/public.
- **Launch gate:** `static-site/LAUNCH_HOLD` makes deploy.sh refuse to publish, because the pages say
  "Insured" and Mark doesn't have the policy yet. Preview on the LAN: `./preview-lan.sh` →
  http://192.168.1.203:8080.
- CRM + quote intake: `../Handman-services` (own README, docs/launch-checklist.md).

## Update, same day: LAUNCHED without insurance (Mark's decision)
- `CONFIG["insured"] = False`, so there's a footer disclosure on every page, an ack checkbox on the quote form, and a narrowed scope
  (no fixture/faucet swaps, tile installs, or big water-damage work). LAUNCH_HOLD removed; deploy.sh still rebuilds first.
- The public Caddyfile now routes /api/* to handyman-intake:8000 (X-Real-IP from CF-Connecting-IP).
- Verified live through Cloudflare: all pages 200, a test quote created a CRM job and sent emails (test deleted).

## Update: job photos via Sanity + plaster
- Sanity project 9678id5i (public dataset `production`). Hosted Studio: https://considerate-home-repair.sanity.studio
  (MCP-managed schema `workProject`). Only published docs with customerPermission == true are shown.
- build.py fetches at build (api.sanity.io, uncached) and prerenders galleries; src/gallery.js refreshes from apicdn on page
  load. New page /handyman/work; galleries on /handyman (featured), service pages and area pages, hidden when empty.
- Drywall service renamed "Drywall & Plaster Repair" (slug unchanged). Deployed live and verified.
