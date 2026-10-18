# Task: generate the illustrations for anydock.ai

For: an agent with an image-generation tool (or a human with one).
Read `AGENTS.md` first. When done, commit **only the image files you added** (plus a Status line in `AGENTS.md`), push,
and redeploy with `cd server && npm run deploy`. Another agent works in this repo at the same time: don't commit or
revert anyone else's files.

## How the page uses them

The landing page (`server/src/landing.ts`) already has a slot for every image below. Until the file exists, the slot
shows a dotted pattern with an icon. As soon as the file is in `server/public/img/…` and deployed, it appears — **no code
change needed**. File names must match exactly.

## Style (same for every image — consistency matters more than any single image)

- **Editorial line illustration** on a **pure white background (#FFFFFF)**.
- Thin, even **near-black ink lines** (#0A0A0B), ~1.5px at final size; rounded line caps; no sketchy or hand-shaky lines.
- **One accent color only: blue #2B59FF**, used sparingly (one or two elements per image: a baton, a highlight, a path).
  Optional very light blue tint #EEF2FF for one filled shape. No other colors, no gradients, no shadows, no textures.
- Simple, slightly **isometric** objects: laptops, chat bubbles, documents, cards, a baton, arrows, keys, plugs, clocks.
  People only as minimal figures (no faces, no skin tones, no gender cues) or just hands — prefer objects.
- **Lots of negative space**; the subject sits in the middle ~60%. Calm, precise, premium (think Linear / Stripe docs).
- **No text, letters, numbers, UI labels, logos or brand marks** anywhere in the image.
- Recurring motif: the **blue baton** (a short rounded bar) being passed — it stands for "the work + its context".

## Files

All use-case images: **1600×1000 px (16:10), WebP, under 150 KB each**, saved to `server/public/img/cases/<slug>.webp`.

| File | Scene to draw |
|---|---|
| `cases/end-of-day.webp` | A laptop closing on the left; a blue baton floating from it to an open laptop on the right. A small moon above the left laptop. |
| `cases/teaching.webp` | An empty presentation easel crossed out lightly; next to it, a document with a blue path flowing into a second laptop that is already working. |
| `cases/on-call.webp` | A pager/phone with a small alert glyph (no text) at night; a blue baton passing from one hand to another over it. |
| `cases/code-review.webp` | Two code-like abstract documents side by side (lines only, no characters) with a blue magnifier over one highlighted line. |
| `cases/spec-to-eng.webp` | A stack of research cards feeding a single spec sheet; a blue arrow carries the stack into a toolbox/workbench. |
| `cases/sales-to-cs.webp` | Two hands in a handshake; a blue ribbon of small cards (the history) passes between them. |
| `cases/where-from.webp` | A bar chart with one bar highlighted blue; a thin dotted line traces from that bar back to a small source document. |
| `cases/follow-the-sun.webp` | A simple globe with a sun on one side and a moon on the other; a blue arc carries the baton around the globe. |
| `cases/research.webp` | Two people-less desks with identical stacks of papers; a blue link connects them so the second stack is already sorted. |
| `cases/escalation.webp` | A support chat bubble on the left, a gear/wrench on the right; a blue folder of evidence slides between them. |
| `cases/orphan-agents.webp` | A small friendly robot (simple geometric) with a blue tag/leash connecting it to a name badge (blank). |
| `cases/access-handover.webp` | A key ring with several keys passing from one hand to another in blue; a faint dotted outline where the keys used to be. |
| `cases/connect-once.webp` | One central blue plug/hub with clean lines out to five simple app tiles (blank squares/circles, no logos). |
| `cases/onboarding.webp` | A new desk with a plant; a tidy blue-bound book of past work open on it, with small cards rising out of it. |

Site images:

| File | Size | Content |
|---|---|---|
| `og.png` | 1200×630 PNG | Social share card. White background; on the right, the baton handover motif (two laptops, blue baton between). Leave the left 55% empty white (text is not needed; the share preview shows the title). |
| `icon.png` | 512×512 PNG | App icon / favicon: the AnyDock mark — three rounded blocks stacked like a dock (one wide base, two smaller on top), near-black on white, the top-right block in blue #2B59FF. Must read clearly at 32×32. |

## Round 2 — avatars for the hero carousel (new)

The hero carousel (`server/src/hero.ts`) shows small round avatars for six fictional teammates. Today they are
initials on a colored circle; once `server/public/img/avatars/<name>.webp` exists, the portrait replaces the initial
automatically (no code change). They render at 22–30px, so they must read at that size.

Style for avatars (different from the line illustrations above, but the same family):
- **Flat, minimal illustrated portrait**, head and shoulders, front or 3/4 view, centered, filling ~80% of the frame.
- **Solid background in the person's color** (below), full-bleed square — the site crops it to a circle.
- Simple shapes, no outlines thicker than ~3% of the width, no gradients, no text, no logos, no photorealism.
- Friendly neutral expression. A diverse set (age, skin tone, hair) — fictional people, not lookalikes of anyone real.
- **512×512 px, WebP, under 40 KB each.**

| File | Background | Person |
|---|---|---|
| `avatars/nolan.webp` | #D97757 | Nolan — product engineer; short dark hair, round glasses, crew-neck sweater. |
| `avatars/jason.webp` | #10A37F | Jason — engineer; short curly hair, light stubble, hoodie. |
| `avatars/mei.webp` | #7C3AED | Mei — data analyst; shoulder-length straight black hair, blazer. |
| `avatars/kai.webp` | #0E7490 | Kai — new hire on growth; buzz cut, denim jacket. |
| `avatars/ashley.webp` | #2B59FF | Ashley — ops lead; long wavy hair, simple top. |
| `avatars/lead.webp` | #0A0A0B | The team lead — gray short hair, collared shirt. |

## Done when

- [ ] All 6 `avatars/*.webp` exist (512×512, < 40 KB each) and read clearly at 28px.
- [ ] All 14 `cases/*.webp`, `og.png` and `icon.png` exist under `server/public/img/` with the exact names and sizes above.
- [ ] Every image follows the style section (white background, black lines, one blue accent, no text or logos).
- [ ] Deployed (`cd server && npm run deploy`) and checked on https://anydock.ai: the use-case carousel shows the images.
- [ ] `AGENTS.md` Status updated; your commit pushed.
