# consideratesystems.com - the live static site

This folder is what https://consideratesystems.com serves. It is a static export
of the Payload/Next app in `app/`, taken on 2026-11-02 when the site moved off
the running app to save money, then hand-edited:

- 2026-11-08: the top nav (Home / Services / Projects / About / Contact) was
  replaced on every page by the contact line: mark@consideratesystems.com and
  (740) 703-2110. The other pages are still reachable from the home page.

**Edit the HTML in `public/` directly, then run `./deploy.sh`** (from the LAN).

## Hosting

The Raspberry Pi `marksraspi` serves it from
`/opt/sites/consideratesystems/public` through the Pi's shared
Caddy (the one in `/opt/crm`, from the Contract-Relationship-Account-Manager
repo), which imports this folder's `Caddyfile`. DNS is Cloudflare with the proxy on
(SSL Full strict) for the apex and www; the origin is the home IP. Until 2026-11-08 it was S3 + CloudFront.

`public/videos/` is not in git; see `deploy.sh`.

## About the Payload app in `app/`

Its database was on RDS and was deleted with no snapshot when the site went
static, so the CMS content is gone. Running the app again means re-entering the
projects and pages, using these HTML files as the source.

Mail for @consideratesystems.com is Cloudflare Email Routing: a catch-all
forwards everything to mark.r.musil@gmail.com (free). Until 2026-11-08 it was
Amazon WorkMail + SES; the mailbox export is in the PC backups.
