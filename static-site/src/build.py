#!/usr/bin/env python3
"""Builds the hand-written pages of consideratesystems.com into ../public.

    python3 -I src/build.py

Writes the new homepage, /engineering, and every /handyman page, plus
sitemap.xml, robots.txt and /assets/. The older engineering pages exported from
Next.js (/services, /projects, /about, /contact) are left alone and stay in the sitemap.

Business facts (rate, hours, insured, areas) live in CONFIG and the tables
below. Change them here and rebuild; never hand-edit the generated HTML.
"""
from __future__ import annotations

import html
import json
import shutil
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = SRC.parent / "public"
BASE = "https://consideratesystems.com"

CONFIG = {
    # Not insured yet (launched 2026-11-12 without coverage, by Mark's decision). While False,
    # every page carries UNINSURED_NOTE, the quote form requires an acknowledgment, and the
    # scope stays limited to small interior jobs. When a policy is active: set True, rebuild,
    # deploy, and add the higher-risk services back if wanted.
    "insured": False,
    "max_job": 600,
    "licensed_columbus_hic": False,   # set True once the City of Columbus HIC license is issued
    "rate": 59,
    "minimum": 125,
    "minimum_hours": 2,
    "honeydo_hours": 3,
    "honeydo_price": 165,
    "materials_markup": "cost + 15%",
    "warranty": "1-year workmanship guarantee",
    "phone_display": "(740) 703-2110",
    "phone_tel": "+17407032110",
    "repair_email": "repairs@consideratesystems.com",
    "eng_email": "mark@consideratesystems.com",
    "google_review_url": "",
    # Google Analytics 4 Measurement ID ("G-..."). Empty = no analytics tag on any page.
    "ga_id": "G-P1HX6GNXCV",          # fill in after the Google Business Profile exists
    "hours_text": "Weeknights 5:30–9 pm · Sat & Sun 12–6 pm",
    "hours_schema": [
        (["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "17:30", "21:00"),
        (["Saturday", "Sunday"], "12:00", "18:00"),
    ],
}
C = CONFIG
HR = "Considerate Home Repair"
LLC = "Considerate Systems LLC"
FONTS = ("https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600"
         "&family=Work+Sans:wght@500;600&display=swap")
HEADSHOT = "/assets/mark-600.jpg"
# Job photos come from Sanity (project "Considerate Home Repair"). Upload at
# https://considerate-home-repair.sanity.studio . The dataset is public-read; no token needed.
SANITY = {"project": "9678id5i", "dataset": "production", "api": "2025-02-19"}
WORK_QUERY = (
    '*[_type == "workProject" && customerPermission == true && defined(afterImage.asset)]'
    ' | order(coalesce(completedOn, _createdAt) desc)[0...60]'
    '{_id, title, service, neighborhood, completedOn, summary, featured,'
    ' "after": afterImage{alt, hotspot, "url": asset->url},'
    ' "before": beforeImage{alt, hotspot, "url": asset->url},'
    ' "more": morePhotos[]{_key, alt, hotspot, "url": asset->url}}'
)
UNINSURED_NOTE = (
    f"{HR} does not currently carry general liability insurance. To keep risk low for you and for me, "
    f"I only take small interior jobs, usually under ${CONFIG['max_job']}: drywall patching, painting, caulk and grout, "
    "trim, and minor repairs. I don't do electrical, plumbing, gas, roofing, structural or exterior work. "
    "I'll confirm this with you in writing before any job is booked, and I'll update this notice when coverage is in place."
)

e = html.escape


def icon(name: str) -> str:
    paths = {
        "wall": '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M9 4v5M15 9v5M9 14v6"/>',
        "roller": '<rect x="3" y="3" width="15" height="6" rx="1"/><path d="M18 6h3v5h-9v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>',
        "tile": '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
        "trim": '<path d="M3 20h18M5 20V8l4-4h10v16"/><path d="M9 4v16"/>',
        "wrench": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
        "key": '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
        "list": '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
        "chip": '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
        "camera": '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
        "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        "shield": '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    }
    return ('<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            f'stroke-linejoin="round">{paths[name]}</svg></span>')


# ---------------------------------------------------------------- business data

SERVICES = [
    {
        "slug": "drywall-repair", "icon": "wall", "name": "Drywall & Plaster Repair",
        "short": "Holes, cracks, nail pops and plaster cracks, patched and blended so you can't find them.",
        "title": "Drywall & Plaster Repair in Columbus, OH | Patches & Cracks",
        "h1": "Drywall & plaster repair in Columbus",
        "desc": "Drywall and plaster repair in Columbus, OH: holes, cracks, nail pops and plaster cracks, texture-matched and primed. Small patches from $145.",
        "intro": "A good patch disappears, whether it's drywall or old plaster. A bad one shows up every time the light hits the wall. I patch, tape, mud, sand and texture-match so the repair blends into the wall around it, then prime it so it's ready for paint.",
        "includes": [
            "Doorknob holes, anchor holes, and holes from TV or shelf removal",
            "Stress cracks over doors and windows, and corner bead repair",
            "Nail pops and seam tape that has lifted",
            "Plaster cracks and small plaster patches in older homes (keyed, taped and skimmed so they stay closed)",
            "Small water-stained patches, after the leak has been fixed and dried out",
            "Small ceiling patches and texture matching (knockdown, orange peel, smooth)",
            "Cutting in and closing up access holes for plumbers and electricians",
        ],
        "how": "Joint compound needs time to dry between coats, so most patches take two short visits: patch and first coat on one evening, then sand, finish and prime the next. That fits my evening schedule well, and you aren't paying for me to stand around waiting for mud to dry.",
        "faq": [
            ("How much does drywall repair cost in Columbus?", f"Small patches (up to about 6 inches) start at $145, including texture match and primer. More patches in the same room are $34 each. Larger repairs up to about 2×2 ft start at $250. Large water-damage or ceiling replacements are bigger than I take on right now, and I'll gladly refer you."),
            ("Do you repair plaster walls?", "Yes. Many homes in Clintonville, Bexley, Worthington and the University District have original plaster. I repair cracks and small holes so they don't come back: loose plaster is secured, cracks are taped, and the area is skimmed to blend with the wall around it."),
            ("Will I be able to see the patch?", "The goal is no. I feather the compound wide and match the existing texture. On smooth walls under strong side light, a fresh coat of paint on the whole wall gives the cleanest result, and I can quote that too."),
            ("Do you paint after the patch?", "Every patch is primed. If you have the leftover paint, touching up the patch is included. Otherwise I can paint the whole wall corner to corner so the sheen matches. See painting."),
        ],
    },
    {
        "slug": "painting", "icon": "roller", "name": "Interior Painting",
        "short": "Single rooms, accent walls, ceilings, trim and doors. Careful prep, straight lines, clean floors.",
        "title": "Interior Painting in Columbus, OH | Rooms, Trim & Ceilings",
        "h1": "Interior painting in Columbus",
        "desc": "Interior painting in Columbus, OH: single rooms, accent walls, trim, doors and ceilings. Careful prep, clean lines. Bedrooms from $380.",
        "intro": "I take on the painting jobs that are too small for a big crew: one bedroom, a hallway, an accent wall, a set of doors, a stained ceiling. Prep is most of the work. I fill and sand, caulk the gaps, cut clean lines, and leave the room the way I found it.",
        "includes": [
            "Bedrooms, offices, bathrooms, hallways and stairwells",
            "Accent walls and color changes",
            "Ceilings, including stain blocking after a leak",
            "Baseboards, casings, crown molding and interior doors",
            "Patching and caulking before painting, included in the price",
            "Rental turnover repaints in neutral colors",
        ],
        "how": "You choose the color and I'll pick up the paint, or you supply it. I use Sherwin-Williams or Benjamin Moore unless you ask for something else. Furniture is moved to the center of the room and covered, and floors are covered with drop cloths.",
        "faq": [
            ("How much does it cost to paint a room in Columbus?", "A standard bedroom (up to about 12×12 ft, walls only, two coats) starts at $380 in labor. Ceilings add about $125 and doors are $38 each. Paint is billed at cost, or you can supply your own."),
            ("Do you paint exteriors or whole houses?", "No. I focus on interior rooms and small projects, which are a good fit for evening and weekend work. For whole-house or exterior painting, I'm happy to refer you to someone."),
            ("How long does one room take?", "Usually two evenings or one weekend afternoon plus an evening, depending on prep and the number of coats."),
        ],
    },
    {
        "slug": "tile", "icon": "tile", "name": "Tile, Grout & Caulk Repair",
        "short": "Regrouting, re-caulking tubs and showers, and replacing a few cracked tiles.",
        "title": "Tile Repair, Regrouting & Re-Caulking | Columbus, OH",
        "h1": "Tile, grout & caulk repair",
        "desc": "Tile repair in Columbus, OH: regrouting, re-caulking tubs and showers, and cracked tile replacement. Re-caulk from $125, regrout from $250.",
        "intro": "Most tile problems are small: a cracked tile, grout that's crumbling or stained, or caulk that has mildewed or pulled away. I fix those properly, without tearing anything out.",
        "includes": [
            "Re-caulking tubs, showers and backsplashes (old caulk fully removed)",
            "Regrouting tub surrounds and shower walls",
            "Replacing cracked or loose tiles (when matching tile is available)",
            "Grout sealing",
        ],
        "how": "Grout needs cure time, so regrouting is usually spread over two visits. New tile installations (backsplashes, floors, showers) are outside what I take on right now.",
        "faq": [
            ("How much does it cost to regrout a shower in Columbus?", "Regrouting and re-caulking a standard tub surround starts at $250. Replacing up to five cracked tiles starts at $190 if matching tile is available."),
            ("Do you fix leaking showers?", "I can regrout and re-caulk, which fixes most surface leaks. If the waterproofing behind the tile has failed, that's a full rebuild. I'll tell you honestly and point you to the right contractor."),
        ],
    },
    {
        "slug": "interior-finishing", "icon": "trim", "name": "Trim & Interior Finishing",
        "short": "Baseboards, casing, doors, shoe molding, caulk and the finish details that make a room look done.",
        "title": "Trim Carpentry & Interior Finishing | Columbus, OH",
        "h1": "Trim & interior finishing",
        "desc": "Trim carpentry and interior finishing in Columbus, OH: baseboards, door casing, shoe molding, interior doors, door adjustments and caulking.",
        "intro": "Interior finishing is my day job. I'm an apprentice with a professional interior finishing company, and I take the small finish jobs they don't want, on evenings and weekends: trim that's been missing since the flooring went in, a door that sticks, gaps that need caulking.",
        "includes": [
            "Baseboard, shoe molding and quarter round, including after new flooring",
            "Door and window casing",
            "Hanging pre-hung interior doors and adjusting sticking doors",
            "Replacing door hardware, hinges and strike plates",
            "Caulking and filling trim before paint",
            "Closet shelving and small built-in touch-ups",
        ],
        "how": "Trim is measured and cut on site, with coped inside corners where it matters. Trim gets caulked, filled and ready for paint, or I paint it too.",
        "faq": [
            ("How much does baseboard installation cost?", "Usually $5–$7 per linear foot of labor, depending on profile and corners, with a $125 minimum. Most single rooms come to $210–$380."),
            ("Can you fix a door that won't latch or sticks?", "Yes. Most sticking or unlatched doors are fixed within the $125 minimum by adjusting the hinges, the strike plate, or planing the door."),
        ],
    },
    {
        "slug": "small-repairs", "icon": "wrench", "name": "General Small Repairs",
        "short": "The to-do list: mounting, hanging, caulking, weatherstripping, assembly, door fixes.",
        "title": "Handyman for Small Repairs in Columbus, OH | Honey-Do Lists",
        "h1": "Small repairs and honey-do lists",
        "desc": "Handyman for small repairs in Columbus, OH: TV mounting, shelves, caulking, weatherstripping, assembly. 3-hour Honey-Do block for $165.",
        "intro": "Most homes have a list of small things that never get done because each one is too small to call someone about. Bundle the list and I'll work through it in one evening, at one price.",
        "includes": [
            "TV, shelf, mirror, curtain rod and picture hanging (into studs or anchored properly)",
            "Cabinet hardware, towel bars, and loose railings and handles",
            "Weatherstripping, door sweeps and drafty-window fixes",
            "Caulking windows, tubs and sinks",
            "Furniture and closet system assembly",
            "Smoke and CO detector replacement",
        ],
        "how": f"Send me the list (photos help). Most lists fit into the {C['honeydo_hours']}-hour Honey-Do block for ${C['honeydo_price']}. If something needs a part, I'll pick it up beforehand so the visit isn't spent driving to the store.",
        "faq": [
            ("What's the minimum charge?", f"${C['minimum']}, which covers up to {C['minimum_hours']} hours of work. After that it's ${C['rate']}/hr, or book the {C['honeydo_hours']}-hour Honey-Do block for ${C['honeydo_price']}."),
            ("Do you do electrical or plumbing?", "No. I don't do any electrical, plumbing, gas, roofing, structural or exterior work. That keeps every job small and low-risk. I'll tell you if your job needs a licensed electrician or plumber."),
        ],
    },
]

PRICES = [
    ("Drywall", [
        ("Small patch (up to ~6\") — texture matched & primed", "Usually 2 short visits", "$145"),
        ("Each additional small patch, same room", "", "+$34"),
        ("Medium repair (up to ~2×2 ft)", "After any leak is fixed and dry", "$250"),
    ]),
    ("Painting (labor; paint at cost or supplied)", [
        ("Accent wall", "", "$145"),
        ("Standard bedroom, walls, 2 coats", "Up to ~12×12 ft", "$380"),
        ("Add ceiling", "", "+$125"),
        ("Interior door, both sides", "", "$38 / door"),
    ]),
    ("Tile", [
        ("Re-caulk tub or shower", "Old caulk fully removed", "$125"),
        ("Regrout + re-caulk tub surround", "", "$250"),
        ("Replace up to 5 cracked tiles", "Matching tile required", "$190"),
    ]),
    ("Trim, doors & small repairs", [
        ("Baseboard / shoe molding", "Labor", "$5–7 / ft"),
        ("Adjust a sticking or unlatched door", "", "$125"),
        ("Hang a pre-hung interior door", "", "$210"),
        ("Mount a TV (your mount, drywall)", "", "$125"),
    ]),
]

AREAS = [
    {"slug": "clintonville", "name": "Clintonville", "near": "a few minutes",
     "body": "Clintonville's 1920s–1950s homes are full of character, and full of plaster walls, settling cracks over doorways, and tile bathrooms from before most of us were born. I patch plaster and drywall cracks, regrout vintage tile when it can be saved, and repaint rooms without damaging old trim.",
     "jobs": ["Plaster and drywall crack repair", "Regrouting vintage bathroom tile", "Repainting bedrooms and stairwells", "Sticking doors from house settling"]},
    {"slug": "linden", "name": "Linden & North Columbus", "near": "my home base",
     "body": "I live here, so North Linden and South Linden, Northern Woods, Agler and the 43211/43224 area get my fastest response. Lots of mid-century homes and rentals here, and lots of drywall patches, rental turnovers and repainting between tenants.",
     "jobs": ["Rental turnover repairs and repaints", "Drywall holes and doorknob damage", "Re-caulking tubs and showers", "Small fix lists for homeowners"]},
    {"slug": "university-district", "name": "University District", "near": "about 10 minutes",
     "body": "Campus-area rentals take a beating every school year. Between tenants, landlords need fast, tidy work that's priced sensibly: patched walls, fresh neutral paint, re-caulked tubs, doors that latch. I work evenings and weekends, which fits turnover windows.",
     "jobs": ["Move-out damage repair", "Neutral repaints between leases", "Door and hardware fixes", "Caulk and grout refresh"]},
    {"slug": "short-north-italian-village", "name": "Short North & Italian Village", "near": "about 10 minutes",
     "body": "Renovated historic homes and newer condos in the Short North, Italian Village and Victorian Village call for careful, clean work. I fix drywall cracks at seams, touch up custom paint colors, and refresh grout and caulk, with drop cloths down and a clean space when I leave.",
     "jobs": ["Condo drywall and paint touch-ups", "Grout and caulk refresh", "Trim and caulk detailing", "TV and art mounting"]},
    {"slug": "westerville", "name": "Westerville", "near": "about 15 minutes",
     "body": "Uptown Westerville has older homes, and the subdivisions around it are mostly 1970s–2000s builds. That means nail pops, corner bead cracks, builder-grade caulk that's given out, and bedrooms due for a new color. These are quick evening jobs.",
     "jobs": ["Nail pops and corner bead repair", "Bedroom and accent wall painting", "Tub and shower re-caulking", "Baseboard after new flooring"]},
    {"slug": "worthington", "name": "Worthington", "near": "about 15 minutes",
     "body": "From Old Worthington's historic homes to the mid-century ranches around them, Worthington homeowners expect careful work. I take on the small finishing jobs: matching trim profiles, repairing plaster and drywall, and painting single rooms.",
     "jobs": ["Trim repair and replacement", "Plaster and drywall patching", "Single-room painting", "Door adjustments"]},
    {"slug": "gahanna", "name": "Gahanna", "near": "about 15 minutes",
     "body": "Gahanna's 1980s–2000s subdivisions have reached the age where drywall seams crack, nail pops show up, and the original tile grout needs attention. I handle those repairs on evenings and weekends, without a big-company minimum.",
     "jobs": ["Drywall seam and nail pop repair", "Shower regrouting", "Bedroom and accent wall painting", "Honey-do lists"]},
    {"slug": "bexley", "name": "Bexley", "near": "about 15 minutes",
     "body": "Bexley's older brick homes have plaster walls, original tile baths and lots of trim. I repair plaster and drywall carefully, regrout and re-caulk tile, and paint single rooms with sharp cut lines next to old woodwork.",
     "jobs": ["Plaster crack repair", "Tile regrouting and caulking", "Painting around original woodwork", "Door and hardware fixes"]},
]


# ---------------------------------------------------------------- page chrome

def jsonld(obj) -> str:
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'<script type="application/ld+json">{s}</script>'


GA_START, GA_END = "<!-- ga4 -->", "<!-- /ga4 -->"


def analytics_tag() -> str:
    """GA4 tag, plus events for phone and email link clicks (GA doesn't track tel:/mailto: by itself).
    The quote form sends its own generate_lead event (quote.js)."""
    gid = C.get("ga_id")
    if not gid:
        return ""
    return (GA_START + f'<script async src="https://www.googletagmanager.com/gtag/js?id={gid}"></script>'
            "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}"
            f"gtag('js',new Date());gtag('config','{gid}');"
            "document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a[href]');if(!a)return;"
            "var h=a.getAttribute('href');if(h.indexOf('tel:')===0)gtag('event','phone_click',{link_url:h});"
            "else if(h.indexOf('mailto:')===0)gtag('event','email_click',{link_url:h});});</script>" + GA_END)


def tag_legacy_pages() -> None:
    """Put the analytics tag in the exported Next pages (not built here), replacing any older copy."""
    for f in list(OUT.glob("*.html")) + list((OUT / "projects").glob("**/*.html")):
        html = f.read_text(encoding="utf-8")
        if 'href="/assets/site.css"' in html or "</head>" not in html:
            continue  # pages built by this script get the tag from head()
        if GA_START in html:
            html = html[:html.index(GA_START)] + html[html.index(GA_END) + len(GA_END):]
        tag = analytics_tag()
        if tag:
            html = html.replace("</head>", tag + "</head>", 1)
        f.write_text(html, encoding="utf-8")


def head(*, title: str, desc: str, path: str, og_image: str = "/og-image.jpg", schema=None) -> str:
    url = BASE + path
    parts = [
        '<!doctype html><html lang="en"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{e(title)}</title>",
        f'<meta name="description" content="{e(desc)}">',
        f'<link rel="canonical" href="{url}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{LLC}">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{BASE}{og_image}">',
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="theme-color" content="#2e3b4a">',
        '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/icon.svg" type="image/svg+xml">',
        '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        f'<link rel="stylesheet" href="{FONTS}">',
        '<link rel="stylesheet" href="/assets/site.css">',
        analytics_tag(),
    ]
    for s in (schema or []):
        parts.append(jsonld(s))
    parts.append("</head>")
    return "".join(parts)


def header(kind: str, current: str = "") -> str:
    if kind == "repair":
        links = [("/handyman", "Home Repair"), ("/handyman/work", "Our Work"), ("/handyman/pricing", "Pricing"),
                 ("/handyman/realtors-landlords", "Realtors & Landlords"), ("/engineering", "Engineering")]
        sub = "Home Repair"
        cta = (f'<div class="head-cta"><a class="btn btn-ghost btn-sm btn-call" href="tel:{C["phone_tel"]}">{C["phone_display"]}</a>'
               '<a class="btn btn-primary btn-sm" href="/handyman/quote">Get a quote</a></div>')
    else:
        links = [("/engineering", "Engineering"), ("/projects", "Projects"), ("/about", "About"),
                 ("/handyman", "Home Repair")]
        sub = "Engineering" if kind == "eng" else ""
        cta = (f'<div class="head-cta"><a class="btn btn-ghost btn-sm btn-call" href="tel:{C["phone_tel"]}">{C["phone_display"]}</a></div>')
    nav = "".join(
        f'<a href="{h}"{" aria-current=page" if h == current else ""}>{t}</a>' for h, t in links)
    subhtml = f'<span class="brand-sub">{sub}</span>' if sub else ""
    return (
        '<a class="skip" href="#main">Skip to content</a>'
        '<header class="site-head"><div class="wrap">'
        f'<a class="brand" href="/"><img src="/logo.svg" alt="{LLC}" width="168" height="48">{subhtml}</a>'
        f'<nav class="nav" aria-label="Main">{nav}</nav>{cta}</div></header>'
    )


def footer(kind: str) -> str:
    svc = "".join(f'<li><a href="/handyman/{s["slug"]}">{e(s["name"])}</a></li>' for s in SERVICES)
    areas = "".join(f'<li><a href="/handyman/{a["slug"]}">{e(a["name"])}</a></li>' for a in AREAS)
    insured = " · Insured" if C["insured"] else ""
    callbar = ""
    if kind == "repair":
        callbar = (f'<div class="callbar"><a href="tel:{C["phone_tel"]}">Call / text</a>'
                   '<a href="/handyman/quote">Photo quote</a></div>')
    return (
        '<footer class="site-foot"><div class="wrap"><div class="foot-grid">'
        f'<div><h4>{HR}</h4><p>Evening &amp; weekend handyman in Columbus, OH. Drywall, painting, tile and interior finishing.</p>'
        f'<p><a href="tel:{C["phone_tel"]}">{C["phone_display"]}</a><br><a href="mailto:{C["repair_email"]}">{C["repair_email"]}</a><br>{C["hours_text"]}</p></div>'
        f'<div><h4>Services</h4><ul>{svc}<li><a href="/handyman/work">Our work</a></li><li><a href="/handyman/pricing">Pricing</a></li><li><a href="/handyman/realtors-landlords">Realtors &amp; landlords</a></li></ul></div>'
        f'<div><h4>Service area</h4><ul>{areas}</ul></div>'
        f'<div><h4>Engineering</h4><ul><li><a href="/engineering">Engineering services</a></li><li><a href="/projects">Projects</a></li><li><a href="/about">About Mark</a></li>'
        f'<li><a href="mailto:{C["eng_email"]}">{C["eng_email"]}</a></li></ul></div>'
        '</div>'
        + ("" if C["insured"] else f'<p class="disclosure" id="insurance"><strong>Insurance disclosure.</strong> {e(UNINSURED_NOTE)}</p>') +
        f'<div class="foot-legal">© 2026 {LLC}. {HR} is a division of {LLC}, Columbus, Ohio{insured}.</div>'
        f'</div></footer>{callbar}'
    )


def page(path: str, *, kind: str, title: str, desc: str, body: str, current: str = "", schema=None,
         og_image: str = "/og-image.jpg", scripts: str = "") -> None:
    cls = ' class="has-callbar"' if kind == "repair" else ""
    if kind == "repair" and "gallery.js" not in scripts:
        scripts += '<script src="/assets/gallery.js" defer></script>'
    doc = (head(title=title, desc=desc, path=path, og_image=og_image, schema=schema)
           + f"<body{cls}>" + header(kind, current) + f'<main id="main">{body}</main>'
           + footer(kind) + scripts + "</body></html>\n")
    out = OUT / ("index.html" if path == "/" else path.lstrip("/") + ".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")
    SITEMAP.append(path)


SITEMAP: list[str] = []


# ---------------------------------------------------------------- schema.org

PERSON_ID = BASE + "/#mark"
ORG_ID = BASE + "/#org"
HR_ID = BASE + "/handyman#business"


def person():
    return {"@type": "Person", "@id": PERSON_ID, "name": "Mark Musil",
            "jobTitle": "Electrical Engineer", "url": BASE + "/about",
            "worksFor": {"@id": ORG_ID},
            "sameAs": ["https://www.linkedin.com/in/mark-musil"],
            "address": {"@type": "PostalAddress", "addressLocality": "Columbus",
                        "addressRegion": "OH", "addressCountry": "US"}}


def org():
    return {"@type": "Organization", "@id": ORG_ID, "name": LLC, "url": BASE,
            "logo": BASE + "/logo.svg", "email": C["eng_email"], "telephone": C["phone_tel"],
            "founder": {"@id": PERSON_ID}, "subOrganization": {"@id": HR_ID},
            "address": {"@type": "PostalAddress", "addressLocality": "Columbus",
                        "addressRegion": "OH", "addressCountry": "US"}}


def repair_business():
    hours = [{"@type": "OpeningHoursSpecification", "dayOfWeek": d, "opens": o, "closes": c}
             for d, o, c in C["hours_schema"]]
    areas = [{"@type": "City", "name": "Columbus", "containedInPlace": {"@type": "State", "name": "Ohio"}}]
    areas += [{"@type": "Place", "name": f'{a["name"]}, Columbus, OH'} for a in AREAS]
    catalog = {"@type": "OfferCatalog", "name": "Home repair services", "itemListElement": [
        {"@type": "Offer", "itemOffered": {"@type": "Service", "name": s["name"],
                                            "url": f'{BASE}/handyman/{s["slug"]}'}} for s in SERVICES]}
    return {"@type": "HomeAndConstructionBusiness", "@id": HR_ID, "name": HR,
            "alternateName": "Considerate Systems Handyman",
            "description": "Evening and weekend handyman in Columbus, Ohio: drywall repair, interior painting, tile repair and interior finishing for small jobs.",
            "url": BASE + "/handyman", "telephone": C["phone_tel"], "email": C["repair_email"],
            "image": BASE + "/og-handyman.jpg?v=3", "logo": BASE + "/logo.svg",
            "priceRange": "$$", "parentOrganization": {"@id": ORG_ID}, "founder": {"@id": PERSON_ID},
            "address": {"@type": "PostalAddress", "addressLocality": "Columbus",
                        "addressRegion": "OH", "postalCode": "43211", "addressCountry": "US"},
            "geo": {"@type": "GeoCoordinates", "latitude": 40.02, "longitude": -82.98},
            "areaServed": areas, "openingHoursSpecification": hours,
            "hasOfferCatalog": catalog, "paymentAccepted": "Cash, Check, Credit Card, Venmo, Zelle"}


def crumbs_schema(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": BASE + p} for i, (n, p) in enumerate(items)]}


def faq_schema(faqs):
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}


def graph(*nodes):
    return [{"@context": "https://schema.org", "@graph": list(nodes)}]


# ---------------------------------------------------------------- shared blocks

def trust_list() -> str:
    items = ["Evenings & weekends", "Upfront prices", C["warranty"]]
    if C["insured"]:
        items.insert(0, "Insured")
    items.append("Photo quotes, usually within 24 hrs")
    return '<ul class="trust">' + "".join(f"<li>{e(i)}</li>" for i in items) + "</ul>"


def crumbs(items) -> str:
    links = " / ".join(f'<a href="{p}">{e(n)}</a>' for n, p in items[:-1])
    return f'<nav class="crumbs" aria-label="Breadcrumb">{links} / {e(items[-1][0])}</nav>'


def cta_band(heading="Have a repair in mind?", text="Send a few photos and I'll text or email back a price, usually within 24 hours."):
    return (f'<section class="cta-band"><div class="wrap"><div><h2>{e(heading)}</h2><p style="margin:0">{e(text)}</p></div>'
            f'<div class="actions"><a class="btn btn-light" href="/handyman/quote">Get a photo quote</a>'
            f'<a class="btn btn-ghost" style="color:#fff;border-color:#fff" href="tel:{C["phone_tel"]}">Call or text {C["phone_display"]}</a></div></div></section>')


def faq_block(faqs) -> str:
    return '<div class="faq">' + "".join(
        f"<details><summary>{e(q)}</summary><div><p>{e(a)}</p></div></details>" for q, a in faqs) + "</div>"


def how_it_works() -> str:
    return ('<ol class="steps">'
            '<li><strong>Send photos</strong>Use the quote form or text me photos and a short description. No need to schedule a site visit.</li>'
            '<li><strong>Get a fixed price</strong>Most small jobs get a firm price from the photos. Bigger ones get a range and a quick look in person.</li>'
            '<li><strong>Pick an evening</strong>Weeknights after 5:30 or weekend afternoons. You get a reminder the day before.</li>'
            '<li><strong>Pay when it\'s done</strong>Card, Apple Pay, Venmo, Zelle, check or cash. Jobs over $300 with special-order materials need a materials deposit.</li>'
            '</ol>')


def why_me() -> str:
    ins = "Insured, " if C["insured"] else ""
    return (
        '<div class="about-strip">'
        f'<img src="{HEADSHOT}" alt="Mark Musil, owner of {HR}" width="220" height="275" loading="lazy">'
        '<div><h2>Hi, I\'m Mark.</h2>'
        '<p>I\'m an electrical engineer by training, and by day I\'m an apprentice with a professional interior finishing company in Columbus. '
        f'In the evenings and on weekends I run {HR}, which takes on the small jobs that big outfits pass on or charge a premium for.</p>'
        '<p>You get an engineer\'s attention to detail and a finisher\'s eye for clean work. The prices are written down before I start, '
        f'and if a repair of mine fails because of my workmanship within a year, I come back and fix it free. {ins}tidy, and I show up when I say I will.</p>'
        '</div></div>')


# ---------------------------------------------------------------- job photos (Sanity)

def fetch_work() -> list:
    import urllib.parse
    import urllib.request
    url = (f'https://{SANITY["project"]}.api.sanity.io/v{SANITY["api"]}/data/query/{SANITY["dataset"]}?'
           + urllib.parse.urlencode({"query": WORK_QUERY}))
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return json.load(r).get("result") or []
    except Exception as ex:  # build still works offline; the browser script fills galleries in
        print(f"warning: could not fetch job photos from Sanity ({ex})")
        return []


WORK: list = []
SERVICE_NAMES = {s["slug"]: s["name"] for s in SERVICES}
AREA_NAMES = {a["slug"]: a["name"] for a in AREAS}


def img_url(img, w, h=None) -> str:
    q = f"w={w}" + (f"&h={h}&fit=crop" if h else "") + "&auto=format&q=75"
    hs = (img or {}).get("hotspot")
    if h and hs:
        q += f'&crop=focalpoint&fp-x={hs.get("x", 0.5):.3f}&fp-y={hs.get("y", 0.5):.3f}'
    return f'{img["url"]}?{q}'


def work_card(p) -> str:
    def shot(img, label):
        alt = img.get("alt") or f'{label} photo: {p["title"]}'
        return (f'<a class="shot" href="{e(img_url(img, 1600))}" target="_blank" rel="noopener">'
                f'<img src="{e(img_url(img, 600, 450))}" alt="{e(alt)}" width="600" height="450" loading="lazy">'
                f'<span class="tag">{label}</span></a>')
    pair = p.get("before") and p["before"].get("url")
    imgs = (shot(p["before"], "Before") if pair else "") + shot(p["after"], "After" if pair else "Finished")
    meta = " · ".join(x for x in (SERVICE_NAMES.get(p.get("service"), ""), AREA_NAMES.get(p.get("neighborhood"), "")) if x)
    summ = f'<p>{e(p["summary"])}</p>' if p.get("summary") else ""
    return (f'<figure class="work-card"><div class="work-imgs{" pair" if pair else ""}">{imgs}</div>'
            f'<figcaption><strong>{e(p["title"])}</strong><span class="meta">{e(meta)}</span>{summ}</figcaption></figure>')


def work_filter(service="", area="", featured=False, limit=0) -> list:
    items = [p for p in WORK if (not service or p.get("service") == service)
             and (not area or p.get("neighborhood") == area) and (not featured or p.get("featured"))]
    if featured and not items:
        items = WORK[:]  # nothing marked featured yet: show the latest
    return items[:limit] if limit else items


def work_section(heading, *, service="", area="", featured=False, limit=6, more=True, alt=False) -> str:
    """A gallery block. Hidden when empty; /assets/gallery.js refreshes it from Sanity on page load."""
    items = work_filter(service, area, featured, limit)
    attrs = (f' data-work data-service="{service}" data-area="{area}" data-featured="{1 if featured else 0}"'
             f' data-limit="{limit}"')
    link = '<p style="margin-top:18px"><a href="/handyman/work">See all job photos →</a></p>' if more else ""
    return (f'<section class="{"alt " if alt else ""}work-section"{attrs}{"" if items else " hidden"}><div class="wrap">'
            f'<h2>{e(heading)}</h2><div class="work-grid">{"".join(work_card(p) for p in items)}</div>{link}</div></section>')


# ---------------------------------------------------------------- pages

def build_home():
    body = (
        '<section class="hero"><div class="wrap">'
        '<p class="eyebrow">Columbus, Ohio</p>'
        '<h1>Careful work, from circuit boards to drywall.</h1>'
        f'<p class="lead">{LLC} is Mark Musil\'s practice. It has two sides: an evening and weekend <strong>handyman service</strong> for '
        'Columbus homes, and an <strong>engineering consultancy</strong> for embedded systems, electronics and software.</p>'
        '</div></section>'
        '<section><div class="wrap"><div class="doors">'
        '<div class="door"><p class="eyebrow" style="color:var(--steel)">Home repair</p>'
        f'<h2>{HR}</h2><p>Small home repairs done right, on weeknights and weekend afternoons. Usually $200–$600 jobs that bigger companies don\'t want.</p>'
        '<ul><li>Drywall &amp; plaster repair</li><li>Interior painting</li><li>Tile, grout &amp; caulk repair</li><li>Trim &amp; interior finishing</li><li>Honey-do lists &amp; small repairs</li></ul>'
        f'<p class="small">${C["rate"]}/hr · ${C["minimum"]} minimum · fixed-price photo quotes</p>'
        '<div class="actions"><a class="btn btn-primary" href="/handyman/quote">Get a photo quote</a><a class="btn btn-ghost" href="/handyman">See home repair</a></div></div>'
        '<div class="door dark"><p class="eyebrow">Engineering</p>'
        '<h2>Engineering consulting</h2><p>An electrical engineer in Columbus who carries products from first prototype to deployment.</p>'
        '<ul><li>Embedded systems &amp; firmware</li><li>Electrical, PCB &amp; RF design</li><li>Systems engineering (SysML / MBSE)</li><li>Web platforms, cloud &amp; DevOps</li><li>Machine learning &amp; signal processing</li></ul>'
        '<p class="small" style="color:#b9c6d4">From $120/hr · retainers · fixed-scope projects</p>'
        '<div class="actions"><a class="btn btn-light" href="/engineering">See engineering</a><a class="btn btn-ghost" style="color:#fff;border-color:#9fb3c8" href="/projects">Past projects</a></div></div>'
        '</div></div></section>'
        '<section class="alt"><div class="wrap narrow">' + why_me().replace("<h2>Hi, I'm Mark.</h2>", "<h2>One person, both disciplines</h2>") + '</div></section>'
    )
    page("/", kind="home", title="Columbus Handyman & Engineering | Considerate Systems",
         desc="Considerate Systems LLC, Columbus OH: an evening & weekend handyman (drywall, painting, tile, trim) and electrical & embedded engineering consulting.",
         body=body, schema=graph(org(), person(), repair_business(),
                                 {"@type": "WebSite", "@id": BASE + "/#site", "url": BASE, "name": LLC, "publisher": {"@id": ORG_ID}}))


def build_handyman():
    cards = "".join(
        f'<a class="card card-link" href="/handyman/{s["slug"]}">{icon(s["icon"])}<h3>{e(s["name"])}</h3><p>{e(s["short"])}</p></a>'
        for s in SERVICES)
    areas = ", ".join(f'<a href="/handyman/{a["slug"]}">{e(a["name"])}</a>' for a in AREAS)
    faqs = [
        ("How much does a handyman cost in Columbus?", f"I charge ${C['rate']}/hr with a ${C['minimum']} minimum, which covers up to {C['minimum_hours']} hours. Most jobs get a fixed price instead, quoted from photos. The {C['honeydo_hours']}-hour Honey-Do block is ${C['honeydo_price']}. For comparison, solo handymen in Columbus typically charge $55–$95/hr and franchise companies $75–$125/hr."),
        ("When are you available?", f"{C['hours_text']}. This is my evening and weekend business, so you can book work without taking time off."),
        ("What size jobs do you take?", "Small interior jobs, $125 to about $600: a few patches, a room of paint, a regrout, a list of small fixes. Larger remodels are better served by a full-time contractor, and I'm happy to refer you."),
        ("Are you insured?",
         ("Yes. I carry general liability insurance and can send a certificate of insurance on request. " if C["insured"] else
          "Not yet. I'm a new, one-person business and don't carry general liability insurance yet. To keep risk low, I only take small interior jobs (patching, painting, caulk and grout, trim and minor repairs) and no electrical, plumbing, roofing, structural or exterior work. ")
         + "All workmanship comes with a 1-year guarantee: if a repair fails because of my work, I come back and fix it free."),
        ("Do I need to be home?", "For the first visit, yes. For multi-visit jobs like a second drywall coat or grout, many clients leave a lockbox or door code."),
        ("What areas do you serve?", "Columbus within about 20 minutes of North Linden (43211): Clintonville, the University District, Short North, Westerville, Worthington, Gahanna, Bexley and nearby."),
    ]
    body = (
        '<section class="hero"><div class="wrap">'
        + crumbs([("Home", "/"), ("Home Repair", "/handyman")]) +
        '<p class="eyebrow">Evening &amp; weekend handyman · Columbus, OH</p>'
        '<h1>A careful handyman for the small jobs.</h1>'
        '<p class="lead">Drywall repair, interior painting, tile and trim. Fixed prices from your photos, and the work gets done on weeknights and weekend afternoons, so you don\'t have to take a day off.</p>'
        f'<div class="actions"><a class="btn btn-light" href="/handyman/quote">Get a photo quote</a><a class="btn btn-ghost" style="color:#fff;border-color:#9fb3c8" href="tel:{C["phone_tel"]}">Call or text {C["phone_display"]}</a></div>'
        + trust_list() + '</div></section>'
        f'<section><div class="wrap"><h2>What I do</h2><p class="section-intro">I specialize in finish work, which is what I do every day at my day job, plus the small repairs every house needs.</p><div class="grid grid-3">{cards}'
        f'<a class="card card-link" href="/handyman/realtors-landlords">{icon("key")}<h3>Realtors &amp; Landlords</h3><p>Pre-listing punch lists, inspection repairs and rental turnovers, with photo updates.</p></a></div></div></section>'
        + work_section("Recent work", featured=True, limit=6) +
        '<section class="alt"><div class="wrap"><h2>Simple, upfront pricing</h2>'
        '<div class="rate-box">'
        f'<div class="rate"><div class="big">${C["rate"]}/hr</div><div class="lbl">after the minimum</div></div>'
        f'<div class="rate"><div class="big">${C["minimum"]}</div><div class="lbl">minimum, covers up to {C["minimum_hours"]} hrs</div></div>'
        f'<div class="rate feature"><div class="big">${C["honeydo_price"]}</div><div class="lbl">{C["honeydo_hours"]}-hour Honey-Do block: bring the whole list</div></div>'
        '</div><p style="margin-top:16px"><a href="/handyman/pricing">See the full price menu →</a></p></div></section>'
        f'<section><div class="wrap"><h2>How it works</h2>{how_it_works()}</div></section>'
        f'<section class="alt"><div class="wrap narrow">{why_me()}</div></section>'
        f'<section><div class="wrap narrow"><h2>Questions</h2>{faq_block(faqs)}'
        f'<p style="margin-top:20px">Serving {areas}, and the rest of Columbus within about 20 minutes.</p></div></section>'
        + cta_band()
    )
    page("/handyman", kind="repair", current="/handyman",
         title="Handyman in Columbus, OH | Drywall, Painting & Tile",
         desc=f"Evening & weekend handyman in Columbus, OH: drywall, painting, tile & trim. ${C['rate']}/hr, ${C['minimum']} minimum, fixed-price photo quotes. {C['phone_display']}",
         body=body, og_image="/og-handyman.jpg?v=3",
         schema=graph(repair_business(), org(), person(), faq_schema(faqs),
                      crumbs_schema([("Home", "/"), ("Home Repair", "/handyman")])))


def build_service(s):
    path = f'/handyman/{s["slug"]}'
    others = "".join(f'<li><a href="/handyman/{o["slug"]}">{e(o["name"])}</a></li>' for o in SERVICES if o is not s)
    near = ", ".join(f'<a href="/handyman/{a["slug"]}">{e(a["name"])}</a>' for a in AREAS)
    body = (
        '<section class="hero"><div class="wrap">'
        + crumbs([("Home", "/"), ("Home Repair", "/handyman"), (s["name"], path)]) +
        f'<p class="eyebrow">{HR} · Columbus, OH</p><h1>{e(s["h1"])}</h1><p class="lead">{e(s["intro"])}</p>'
        f'<div class="actions"><a class="btn btn-light" href="/handyman/quote?type={s["slug"]}">Get a photo quote</a><a class="btn btn-ghost" style="color:#fff;border-color:#9fb3c8" href="/handyman/pricing">See prices</a></div>'
        + trust_list() + '</div></section>'
        '<section><div class="wrap"><div class="grid grid-2">'
        '<div><h2>What\'s included</h2><ul class="checks">' + "".join(f"<li>{e(i)}</li>" for i in s["includes"]) + '</ul></div>'
        f'<div><h2>How I work</h2><p>{e(s["how"])}</p><div class="card"><h3>Other services</h3><ul>{others}</ul></div></div>'
        '</div></div></section>'
        + work_section(f'{s["name"]}: recent jobs', service=s["slug"], limit=6) +
        f'<section class="alt"><div class="wrap narrow"><h2>{e(s["name"])}: common questions</h2>{faq_block(s["faq"])}'
        f'<p style="margin-top:18px" class="small">Serving {near}, and nearby Columbus neighborhoods.</p></div></section>'
        + cta_band(f'Need {s["name"].lower()}?')
    )
    svc_schema = {"@type": "Service", "name": s["name"], "serviceType": s["name"], "url": BASE + path,
                  "description": s["desc"], "provider": {"@id": HR_ID},
                  "areaServed": {"@type": "City", "name": "Columbus, OH"}}
    page(path, kind="repair", title=s["title"] + " | Considerate Home Repair" if len(s["title"]) < 50 else s["title"],
         desc=s["desc"], body=body, og_image="/og-handyman.jpg?v=3",
         schema=graph(svc_schema, repair_business(), faq_schema(s["faq"]),
                      crumbs_schema([("Home", "/"), ("Home Repair", "/handyman"), (s["name"], path)])))


def build_pricing():
    tables = ""
    for cat, rows in PRICES:
        trs = "".join(
            f'<tr><td>{e(n)}{f"<span class=note>{e(note)}</span>" if note else ""}</td><td class="price">{e(p)}</td></tr>'
            for n, note, p in rows)
        tables += (f'<div class="table-scroll"><table class="price-table"><caption>{e(cat)}</caption>'
                   f'<thead><tr><th scope="col">Job</th><th scope="col" style="text-align:right">Starting at</th></tr></thead><tbody>{trs}</tbody></table></div>')
    faqs = [
        ("Why are these 'starting at' prices?", "Every house is different. These prices cover the typical case. Send photos and you'll get a firm price before any work starts, and the price won't change unless you add to the job."),
        ("How are materials billed?", f"At {C['materials_markup']} to cover pickup and handling, with receipts available. You're welcome to supply your own materials."),
        ("Is there a trip charge?", f"No trip charge within my service area. The ${C['minimum']} minimum covers travel and up to {C['minimum_hours']} hours of work."),
        ("How do I pay?", "By card or Apple Pay through a secure payment link, or by Venmo, Zelle, check or cash. Jobs over $300 with special-order materials need a materials deposit upfront."),
    ]
    body = (
        '<section class="hero"><div class="wrap">'
        + crumbs([("Home", "/"), ("Home Repair", "/handyman"), ("Pricing", "/handyman/pricing")]) +
        '<p class="eyebrow">Handyman prices · Columbus, OH</p><h1>Handyman pricing</h1>'
        '<p class="lead">Published prices, so you know roughly what a job costs before you call. Send photos and you\'ll get a firm quote.</p>'
        + trust_list() + '</div></section>'
        '<section><div class="wrap"><div class="rate-box" style="margin-bottom:34px">'
        f'<div class="rate"><div class="big">${C["rate"]}/hr</div><div class="lbl">hourly rate, for open-ended work</div></div>'
        f'<div class="rate"><div class="big">${C["minimum"]}</div><div class="lbl">minimum visit, up to {C["minimum_hours"]} hours, no trip charge</div></div>'
        f'<div class="rate feature"><div class="big">${C["honeydo_price"]}</div><div class="lbl">Honey-Do block: {C["honeydo_hours"]} hours on your list, one evening</div></div>'
        f'</div>{tables}<p class="small">Labor prices. Materials at {C["materials_markup"]}, or supply your own. Prices updated November 2026.</p></div></section>'
        '<section class="alt"><div class="wrap narrow"><h2>The Honey-Do block</h2>'
        f'<p>Make a list of every small thing that\'s been bugging you: the loose towel bar, the door that won\'t latch, the cracked caulk, the shelf you never hung. Send it with photos. '
        f'I\'ll confirm it fits into {C["honeydo_hours"]} hours, bring the parts, and work through it in one evening for <strong>${C["honeydo_price"]}</strong> plus materials. '
        'If something won\'t fit, I\'ll tell you before I start, not after.</p>'
        f'<a class="btn btn-primary" href="/handyman/quote?type=honey-do">Book a Honey-Do block</a></div></section>'
        f'<section><div class="wrap narrow"><h2>Pricing questions</h2>{faq_block(faqs)}</div></section>'
        + cta_band()
    )
    offers = {"@type": "OfferCatalog", "name": "Handyman price menu", "itemListElement": [
        {"@type": "Offer", "name": n, "priceSpecification": {"@type": "PriceSpecification", "priceCurrency": "USD",
                                                             "price": "".join(ch for ch in p.split("–")[0] if ch.isdigit() or ch == ".") or None}}
        for _, rows in PRICES for n, _, p in rows]}
    page("/handyman/pricing", kind="repair", current="/handyman/pricing",
         title="Handyman Prices in Columbus, OH | Drywall, Paint & Tile",
         desc=f"Columbus handyman prices: ${C['rate']}/hr, ${C['minimum']} minimum. Drywall patch from $145, bedroom paint from $380, regrout from $250, {C['honeydo_hours']}-hr Honey-Do block ${C['honeydo_price']}.",
         body=body, og_image="/og-handyman.jpg?v=3",
         schema=graph(dict(repair_business(), hasOfferCatalog=offers), faq_schema(faqs),
                      crumbs_schema([("Home", "/"), ("Home Repair", "/handyman"), ("Pricing", "/handyman/pricing")])))


def build_realtors():
    coi = " and a certificate of insurance on request" if C["insured"] else ""
    faqs = [
        ("Can you work from an inspection report?", "Yes. Send the report and mark the items you want done. I'll quote each item separately so you can decide what gets fixed and present it to buyers and sellers."),
        ("Do I need to be there?", "No. Lockbox or code access is fine. You get before and after photos of every item, plus a short summary you can forward to your client."),
        ("Do you offer a rate for repeat work?", "Property managers and agents who send regular work get priority scheduling and a single monthly invoice. Ask about it."),
    ]
    body = (
        '<section class="hero"><div class="wrap">'
        + crumbs([("Home", "/"), ("Home Repair", "/handyman"), ("Realtors & Landlords", "/handyman/realtors-landlords")]) +
        '<p class="eyebrow">For agents, landlords &amp; property managers</p>'
        '<h1>Pre-listing punch lists and rental turnovers, done in the evenings.</h1>'
        f'<p class="lead">Small repairs that hold up a listing or a lease: patched walls, fresh paint, re-caulked tubs, doors that latch. Itemized quotes, lockbox access, before and after photos{coi}.</p>'
        f'<div class="actions"><a class="btn btn-light" href="/handyman/quote?type=punch-list">Send a punch list</a><a class="btn btn-ghost" style="color:#fff;border-color:#9fb3c8" href="tel:{C["phone_tel"]}">Call or text {C["phone_display"]}</a></div>'
        + trust_list()
        + ("" if C["insured"] else '<p class="small" style="color:#cfd8e2;margin-top:18px">Note: I don\'t carry liability insurance yet. '
           'If your brokerage or management company requires a certificate of insurance, I\'m not the right fit yet. '
           'For owners and agents who don\'t require one, I handle small interior items.</p>')
        + '</div></section>'
        '<section><div class="wrap"><div class="grid grid-3">'
        f'<div class="card">{icon("list")}<h3>Pre-listing &amp; inspection repairs</h3><p>Work from the inspection report or your walk-through notes. Each item is quoted separately so it can go into negotiations.</p></div>'
        f'<div class="card">{icon("key")}<h3>Rental turnovers</h3><p>Patch and paint, caulk, replace hardware, hang blinds, swap smoke detectors. Done between leases on evenings and weekends, so units turn faster.</p></div>'
        f'<div class="card">{icon("camera")}<h3>Photo documentation</h3><p>Before and after photos of every item, sent as a single summary. Useful for security deposit records and for clients who can\'t be there.</p></div>'
        '</div></div></section>'
        f'<section class="alt"><div class="wrap"><h2>How it works</h2>{how_it_works()}</div></section>'
        f'<section><div class="wrap narrow"><h2>Questions</h2>{faq_block(faqs)}</div></section>'
        + cta_band("Have a listing or a turnover coming up?", "Send the punch list or inspection report and get an itemized quote.")
    )
    page("/handyman/realtors-landlords", kind="repair", current="/handyman/realtors-landlords",
         title="Handyman for Realtors & Landlords | Columbus, OH",
         desc="Pre-listing punch lists, inspection repairs and rental turnovers in Columbus, OH. Itemized quotes, lockbox access, before & after photos.",
         body=body, og_image="/og-handyman.jpg?v=3",
         schema=graph(repair_business(), faq_schema(faqs),
                      crumbs_schema([("Home", "/"), ("Home Repair", "/handyman"), ("Realtors & Landlords", "/handyman/realtors-landlords")])))


def build_area(a):
    path = f'/handyman/{a["slug"]}'
    svc = "".join(
        f'<a class="card card-link" href="/handyman/{s["slug"]}">{icon(s["icon"])}<h3>{e(s["name"])}</h3><p>{e(s["short"])}</p></a>'
        for s in SERVICES)
    others = " · ".join(f'<a href="/handyman/{o["slug"]}">{e(o["name"])}</a>' for o in AREAS if o is not a)
    body = (
        '<section class="hero"><div class="wrap">'
        + crumbs([("Home", "/"), ("Home Repair", "/handyman"), (a["name"], path)]) +
        f'<p class="eyebrow">Handyman · {e(a["name"])}, Columbus OH</p>'
        f'<h1>Handyman in {e(a["name"])}</h1>'
        f'<p class="lead">{e(a["body"])}</p>'
        f'<div class="actions"><a class="btn btn-light" href="/handyman/quote">Get a photo quote</a><a class="btn btn-ghost" style="color:#fff;border-color:#9fb3c8" href="tel:{C["phone_tel"]}">Call or text {C["phone_display"]}</a></div>'
        + trust_list() + '</div></section>'
        f'<section><div class="wrap"><h2>Common jobs in {e(a["name"])}</h2><ul class="checks">'
        + "".join(f"<li>{e(j)}</li>" for j in a["jobs"]) +
        f'</ul><p>{e(a["name"])} is {e(a["near"])} from my home base in North Linden, so evening appointments are easy to schedule.</p></div></section>'
        + work_section(f'Recent jobs in {a["name"]}', area=a["slug"], limit=6) +
        f'<section class="alt"><div class="wrap"><h2>Services</h2><div class="grid grid-3">{svc}</div>'
        f'<p style="margin-top:20px">Pricing: ${C["rate"]}/hr, ${C["minimum"]} minimum, or fixed prices from photos. <a href="/handyman/pricing">See the price menu →</a></p></div></section>'
        f'<section><div class="wrap narrow">{why_me()}<p class="small" style="margin-top:20px">Also serving: {others}.</p></div></section>'
        + cta_band(f'Need a handyman in {a["name"]}?')
    )
    page(path, kind="repair",
         title=(f'Handyman in {a["name"]}, Columbus OH | Drywall, Paint & Tile' if len(a["name"]) <= 12
                else f'Handyman in {a["name"]}, Columbus OH'),
         desc=f'Evening & weekend handyman in {a["name"]}, Columbus OH: drywall, painting, tile & trim. ${C["rate"]}/hr, ${C["minimum"]} min, fixed-price photo quotes.',
         body=body, og_image="/og-handyman.jpg?v=3",
         schema=graph(dict(repair_business(), areaServed={"@type": "Place", "name": f'{a["name"]}, Columbus, OH'}),
                      crumbs_schema([("Home", "/"), ("Home Repair", "/handyman"), (a["name"], path)])))


def build_work():
    filters = "".join(f'<button type="button" class="chip-btn" data-filter="{s["slug"]}">{e(s["name"])}</button>' for s in SERVICES)
    items = WORK
    body = (
        '<section class="hero"><div class="wrap">'
        + crumbs([("Home", "/"), ("Home Repair", "/handyman"), ("Our Work", "/handyman/work")]) +
        '<p class="eyebrow">Before &amp; after · Columbus, OH</p><h1>Recent work</h1>'
        '<p class="lead">Real jobs from around Columbus, posted with each customer\'s permission. Tap a photo to see it full size.</p>'
        '</div></section>'
        '<section data-work data-service="" data-area="" data-featured="0" data-limit="0" data-empty="1"><div class="wrap">'
        f'<div class="chips work-filters" role="group" aria-label="Filter by service"><button type="button" class="chip-btn on" data-filter="">All</button>{filters}</div>'
        f'<div class="work-grid">{"".join(work_card(p) for p in items)}</div>'
        f'<div class="work-empty"{" hidden" if items else ""}><h2>Photos coming soon</h2><p>Considerate Home Repair is brand new, and job photos go up here as work is finished. '
        'Want to see examples before you book? Ask, and I\'ll text you photos of similar work.</p></div>'
        '</div></section>'
        + cta_band()
    )
    gallery = {"@type": "CollectionPage", "name": "Recent work: Considerate Home Repair", "url": BASE + "/handyman/work",
               "about": {"@id": HR_ID},
               "hasPart": [{"@type": "ImageObject", "contentUrl": p["after"]["url"], "name": p["title"],
                            "description": p.get("summary") or p["title"]} for p in items[:30]]}
    page("/handyman/work", kind="repair", current="/handyman/work",
         title="Handyman Work Photos | Before & After | Columbus, OH",
         desc="Before and after photos of drywall, plaster, painting, tile and trim repairs by Considerate Home Repair in Columbus, OH.",
         body=body, og_image="/og-handyman.jpg?v=3", scripts='<script src="/assets/gallery.js" defer></script>',
         schema=graph(gallery, crumbs_schema([("Home", "/"), ("Home Repair", "/handyman"), ("Our Work", "/handyman/work")])))


def build_quote():
    types = [("drywall-repair", "Drywall"), ("painting", "Painting"), ("tile", "Tile / grout / caulk"),
             ("interior-finishing", "Trim / doors"), ("small-repairs", "Small repairs / mounting"),
             ("honey-do", "Honey-Do list"), ("punch-list", "Realtor / rental punch list"), ("other", "Something else")]
    chips = "".join(f'<label><input type="checkbox" name="jobTypes" value="{v}"> {e(t)}</label>' for v, t in types)
    body = (
        '<section class="hero" style="padding-bottom:40px"><div class="wrap">'
        + crumbs([("Home", "/"), ("Home Repair", "/handyman"), ("Get a quote", "/handyman/quote")]) +
        '<h1>Get a photo quote</h1><p class="lead">Tell me what needs fixing and add a few photos. You\'ll get a price by text or email, usually within 24 hours. There\'s no obligation, and nobody will call you to sell you anything.</p>'
        '</div></section>'
        '<section style="padding-top:32px"><div class="wrap narrow">'
        '<form class="form" id="quote-form" action="/api/quote" method="post" enctype="multipart/form-data" novalidate>'
        '<fieldset><legend>1. What needs doing?</legend>'
        f'<div class="field"><span class="label">Type of work</span><div class="chips">{chips}</div></div>'
        '<div class="field"><label for="description">Describe the job</label>'
        '<p class="hint">Sizes help: "two fist-sized holes in a hallway", "regrout a 5 ft tub surround", "paint a 12×12 bedroom".</p>'
        '<textarea id="description" name="description" required maxlength="4000"></textarea></div>'
        '<div class="field"><label for="photos">Photos (up to 8)</label><p class="hint">Take one wide shot and one close-up of each problem. Phone photos are fine; they\'re shrunk automatically before upload.</p>'
        '<div class="drop"><input type="file" id="photos" name="photos" accept="image/*" multiple></div><div class="thumbs" id="thumbs"></div></div>'
        '</fieldset>'
        '<fieldset><legend>2. Where and when?</legend>'
        '<div class="row-2"><div class="field"><label for="street">Street address</label><input type="text" id="street" name="street" autocomplete="street-address"></div>'
        '<div class="field"><label for="zip">ZIP code</label><input type="text" id="zip" name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="postal-code" required></div></div>'
        '<div class="field"><label for="timing">When would you like it done?</label><select id="timing" name="timing">'
        '<option>As soon as possible</option><option>Within 2 weeks</option><option>Within a month</option><option>Flexible / just getting a price</option></select></div>'
        '<div class="field"><label for="clientType">I am a…</label><select id="clientType" name="clientType">'
        '<option>Homeowner</option><option>Renter (with landlord OK)</option><option>Landlord / property manager</option><option>Realtor</option><option>Other</option></select></div>'
        '</fieldset>'
        '<fieldset><legend>3. How do I reach you?</legend>'
        '<div class="row-2"><div class="field"><label for="firstName">First name</label><input type="text" id="firstName" name="firstName" autocomplete="given-name" required maxlength="100"></div>'
        '<div class="field"><label for="lastName">Last name</label><input type="text" id="lastName" name="lastName" autocomplete="family-name" maxlength="100"></div></div>'
        '<div class="row-2"><div class="field"><label for="phone">Mobile phone</label><input type="tel" id="phone" name="phone" autocomplete="tel" maxlength="30"></div>'
        '<div class="field"><label for="email">Email</label><input type="email" id="email" name="email" autocomplete="email" maxlength="200"></div></div>'
        '<div class="field"><label for="contactPref">Best way to send the quote</label><select id="contactPref" name="contactPref"><option>Text</option><option>Email</option><option>Phone call</option></select></div>'
        '<div class="field"><label for="heardFrom">How did you hear about me? (optional)</label><select id="heardFrom" name="heardFrom">'
        '<option value="">—</option><option>Google search</option><option>Google Maps</option><option>Nextdoor</option><option>Facebook</option><option>Friend / neighbor</option><option>Realtor / property manager</option><option>Yard sign / flyer</option><option>Repeat customer</option><option>Other</option></select></div>'
        '<div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="cs_trap" tabindex="-1" autocomplete="off" data-lpignore="true" data-1p-ignore></label></div>'
        '</fieldset>'
        + ("" if C["insured"] else
           '<div class="field ack"><label><input type="checkbox" name="ackUninsured" value="yes" required> '
           f'I understand that {HR} is not insured yet and only takes small interior jobs. '
           '<a href="#insurance">Read the disclosure</a>.</label></div>') +
        '<button class="btn btn-primary" type="submit" id="submit-btn" style="width:100%">Send for a quote</button>'
        '<div class="form-status" id="form-status" role="status" aria-live="polite"></div>'
        f'<p class="small" style="margin-top:14px">Rather talk? Call or text <a href="tel:{C["phone_tel"]}">{C["phone_display"]}</a>. Your details are only used to quote and schedule your job. I never sell them or share them.</p>'
        '</form></div></section>'
    )
    page("/handyman/quote", kind="repair",
         title="Get a Handyman Quote from Photos | Columbus, OH",
         desc="Send photos of your drywall, painting, tile or repair job and get a fixed-price quote by text or email, usually within 24 hours. Columbus, OH.",
         body=body, og_image="/og-handyman.jpg?v=3", scripts='<script src="/assets/quote.js" defer></script>',
         schema=graph(repair_business(), crumbs_schema([("Home", "/"), ("Home Repair", "/handyman"), ("Get a quote", "/handyman/quote")])))


def build_engineering():
    areas = [
        ("chip", "Embedded systems & firmware", "Embedded Linux (OpenWRT, PetaLinux, Debian), bare-metal and RTOS firmware in C/C++, Xilinx Zynq SoC/FPGA in VHDL and Verilog, sensor buses (SPI, I2C, Modbus, RS-485), and IoT fleets over MQTT."),
        ("wall", "Electrical, PCB & RF engineering", "Schematic capture and PCB layout in Fusion 360, antenna design and characterization, WiFi/LTE/Bluetooth radio design and test, and lab verification with VNAs, spectrum analyzers and oscilloscopes."),
        ("list", "Systems engineering (MBSE)", "Requirements, SysML and UML architecture in Cameo/MagicDraw and Papyrus, and reverse engineering of existing C++ codebases into maintainable models. Experience at the system-of-systems level on radar and counter-drone systems."),
        ("trim", "Web, cloud & DevOps", "Websites and web apps (React, Next.js, Payload CMS, WordPress), deployed on infrastructure you own: Terraform, Docker, AWS, or self-hosted servers, with CI/CD and ongoing maintenance."),
        ("camera", "Machine learning & signal processing", "Computer-vision detection models (custom YOLO), speech-to-text pipelines, time-series anomaly detection for predictive maintenance, and classical DSP for small-signal and radar work."),
    ]
    cards = "".join(f'<div class="card">{icon(i)}<h3>{e(t)}</h3><p>{e(d)}</p></div>' for i, t, d in areas)
    faqs = [
        ("Do you work with Columbus-area companies on site?", "Yes. I'm based in Columbus, Ohio, and can work on site anywhere in central Ohio, or remotely anywhere."),
        ("How are engineering engagements priced?", "Hourly from $120/hr for advisory work and debugging, monthly retainers for ongoing support, and fixed-scope quotes for defined projects."),
        ("Can you take a product from prototype to production?", "That's the core of the practice: architecture, schematic and PCB, firmware, the cloud and web side, and the documentation to hand it all off."),
    ]
    body = (
        '<section class="hero"><div class="wrap">'
        + crumbs([("Home", "/"), ("Engineering", "/engineering")]) +
        '<p class="eyebrow">Electrical &amp; embedded engineer · Columbus, OH</p>'
        '<h1>Engineering consulting in Columbus, Ohio</h1>'
        '<p class="lead">Mark Musil is an electrical engineer with ten years across hardware and software, from antenna design and FPGA firmware to machine learning and cloud infrastructure. '
        'One engineer who can take an idea from a SysML diagram to a deployed, maintained product.</p>'
        f'<div class="actions"><a class="btn btn-light" href="mailto:{C["eng_email"]}?subject=Engineering%20project">Request a quote</a><a class="btn btn-ghost" style="color:#fff;border-color:#9fb3c8" href="/projects">See past projects</a></div>'
        '</div></section>'
        f'<section><div class="wrap"><h2>Capabilities</h2><div class="grid grid-3">{cards}</div>'
        '<p style="margin-top:20px"><a href="/services">Detailed services and engagement models →</a> · <a href="/about">Résumé and background →</a></p></div></section>'
        '<section class="alt"><div class="wrap narrow"><h2>Experience</h2><ul class="checks">'
        '<li>Embedded Linux IoT fleet for smart water heaters (OpenWRT, MQTT, PCB, RF), Armada Power</li>'
        '<li>Radar systems software and CI/CD on AWS, ECS Federal</li>'
        '<li>Counter-drone system architecture with SysML/MBSE, ManTech</li>'
        '<li>Ground-penetrating radar on Zynq SoC/FPGA, Sawback Technologies</li>'
        '<li>Computer-vision bacteria detection platform on AWS</li>'
        f'</ul></div></section><section><div class="wrap narrow"><h2>Questions</h2>{faq_block(faqs)}</div></section>'
        f'<section class="cta-band"><div class="wrap"><div><h2>Have a project in mind?</h2><p style="margin:0">Email a short description and I\'ll reply within one business day.</p></div>'
        f'<div class="actions"><a class="btn btn-light" href="mailto:{C["eng_email"]}">{C["eng_email"]}</a></div></div></section>'
    )
    svc = {"@type": "ProfessionalService", "@id": BASE + "/engineering#service", "name": f"{LLC}: Engineering",
           "url": BASE + "/engineering", "telephone": C["phone_tel"], "email": C["eng_email"], "priceRange": "$$$",
           "description": "Electrical, embedded systems, firmware, PCB/RF, systems engineering and software consulting in Columbus, Ohio.",
           "address": {"@type": "PostalAddress", "addressLocality": "Columbus", "addressRegion": "OH", "addressCountry": "US"},
           "areaServed": [{"@type": "City", "name": "Columbus, OH"}, {"@type": "Country", "name": "United States"}],
           "founder": {"@id": PERSON_ID}, "parentOrganization": {"@id": ORG_ID},
           "knowsAbout": ["Embedded systems", "Firmware", "PCB design", "RF engineering", "FPGA", "SysML", "MBSE", "DevOps", "Machine learning"]}
    page("/engineering", kind="eng", current="/engineering",
         title="Electrical & Embedded Engineer | Columbus, OH",
         desc="Engineering consultant in Columbus, Ohio: embedded systems & firmware, PCB & RF design, SysML/MBSE, web & cloud, and machine learning, prototype to deployment.",
         body=body, schema=graph(svc, org(), person(), faq_schema(faqs),
                                 crumbs_schema([("Home", "/"), ("Engineering", "/engineering")])))


def write_assets():
    (OUT / "assets").mkdir(exist_ok=True)
    shutil.copy(SRC / "site.css", OUT / "assets" / "site.css")
    shutil.copy(SRC / "quote.js", OUT / "assets" / "quote.js")
    shutil.copy(SRC / "gallery.js", OUT / "assets" / "gallery.js")


def write_sitemap():
    legacy = ["/services", "/projects", "/about", "/contact"]
    urls = sorted(set(SITEMAP + legacy), key=lambda p: (p != "/", p))
    prio = lambda p: "1.0" if p in ("/", "/handyman") else "0.8" if p.count("/") == 1 or p == "/handyman/pricing" else "0.6"
    items = "".join(f"<url><loc>{BASE}{p}</loc><lastmod>2026-11-12</lastmod><priority>{prio(p)}</priority></url>" for p in urls)
    (OUT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>\n')
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {BASE}/sitemap.xml\n")


def main():
    WORK.extend(fetch_work())
    print(f"{len(WORK)} published job photo sets from Sanity")
    build_home()
    build_handyman()
    for s in SERVICES:
        build_service(s)
    build_pricing()
    build_realtors()
    for a in AREAS:
        build_area(a)
    build_quote()
    build_work()
    build_engineering()
    write_assets()
    write_sitemap()
    tag_legacy_pages()
    print(f"Built {len(SITEMAP)} pages into {OUT}")


if __name__ == "__main__":
    main()
