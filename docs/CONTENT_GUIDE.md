# Content guide

Content is JSON under `content/`. Run `npm run validate:content` after every edit; it reports all problems at once.

- `tracks.json`: audience tracks.
- `references.json`: sources. Set `verified: true` only after you have opened the source.
- `packs/<id>.json`: one activity. File name must equal `id`.

## Check-in pack
Domains with `polarity` (`risk` or `protective`), a `scale`, items with `domain`, optional `reverse`. An item with `safety: true, scored: false` never changes a score and raises a clinician flag when answered above the lowest option. Bands: `watchFrom` and `exploreFrom` (0 to 100).

## Scenario pack
Each scenario has three options worth exactly 0, 1 and 2 points, each with an `outcome` shown to the client and a clinician `note`.

## Rules
- Write original items. Do not copy or lightly paraphrase licensed instruments.
- Keep language simple, culturally appropriate and non-diagnostic.
- Keep `status: "draft"` until a licensed psychologist signs off.
- Cite what informed the topic areas, not what the items "are".
