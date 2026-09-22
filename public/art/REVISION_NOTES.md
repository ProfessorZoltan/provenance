# Provenance — Local art revision 02

This is an isolated review copy. The Git repository and GitHub were not changed.

Open `public/art/index.html` in a browser. No build, installation, or internet connection is required. Keep the accompanying folders beside the HTML file. The gallery offers original/revised comparisons, scene layers, six timeline comparisons, era browsing, and a hide-labels control.

## Direction

Locations prioritize recognizable architecture and objects over the earlier strict pixel constraint. Ports have ships and cranes; server facilities have racks, fans and cooling equipment; civic buildings have columns and seating; shops have counters and merchandise. Altered histories change the actual structures and use of a place, including intact versus burned buildings, refuge versus ruins, resistance versus occupation, and public access versus rationing.

Characters and enemies follow the user's subsequent correction: coarse, original FF1-inspired pixel sprites with stepped silhouettes, restrained colors and distinct equipment. They are not copied Final Fantasy sprites. Battle cells are 32×48, portraits 32×32, and map tokens 16×24. Party faces left and enemies face right for horizontal battles.

## Design cross-reference and source

- [Complete asset-to-design mapping](ART_GUIDE.md)
- [Original game design document](GAME_DESIGN_v0.1.md)
- [Machine-readable catalog](catalog.json)

The source snapshot includes `docs/DEEP_SITE_REVISION.md`, `docs/WAYPOINT_REVISION.md`, and `docs/CHARACTER_REVISION.md` with detailed recognition cues, sizes and generation notes. The source design document is reference material; later user art direction takes precedence. Unspecified appearances and geography remain visual proposals.

## Editing later

Edit the appropriate `scripts/art-*.mjs` generator in this local copy, then run `npm run art:build` and `npm run art:check`. No dependencies are required for those commands beyond Node.js. `scripts/art-review.mjs` regenerates the comparison viewer. `before/` and `baseline.json` preserve the earlier library and should not be regenerated during normal edits.

Stable asset IDs and file roles are preserved. Read each SVG viewBox for its size and preserve its aspect ratio. Deep Site scenes use 640×360 and Waypoints use 480×270. Use nearest-neighbor scaling for character sprites. Prepared artwork does not implement new quests, encounters, ending logic, or timeline rules.

## Verification

The complete catalog is checked for missing files, duplicate IDs, portable standalone SVGs, guide references, required location coverage and unique character poses. Scene generators were also checked for exact layer composition and deterministic output. Contact sheets were visually reviewed. This revision changes artwork and review tools; gameplay tests from the earlier snapshot have not been rerun for this artwork-only pass.
