# Provenance art handoff

This is a source snapshot of the local game with the complete artwork library integrated. It includes all 637 SVG assets, editable generators, machine-readable manifests, the design source and the art-to-design mapping.

Start with `docs/ART_GUIDE.md`. For an offline visual browser, open `public/art/index.html` directly. The gallery does not require a server or external dependencies.

For future edits in Claude Code, use this folder as the project, or use the existing local provenance repository. Run `npm ci`, then `npm run dev`. Edit generator files rather than generated assets. Run `npm run art:build` and `npm run art:check` after changes. Normal game validation is `npm run build` and `npm test`.

The existing Kell slice is playable. Artwork for future content is prepared, but that content is not implemented. The guide identifies visual proposals and explains stable IDs, poses, layers and timeline variants. No changes have been pushed to GitHub.

Validation: all 637 SVG files parsed as XML; art coverage and character pose checks passed; production build passed; 43 tests passed, including 3 new art integration checks.
