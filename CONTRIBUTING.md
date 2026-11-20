# Contributing

Roster Lab is Harry Malhi’s project. Changes should keep provider claims honest.

- Do not label a simulated result, a role, or a local MCP call as a live Duet or dot.
- Do not add a paid model API as a requirement for `npm test` or `npm run dev`.
- Do not commit secrets, tokens, or a filled-in `secrets.json`.
- If you reuse code, record the license and the version in `THIRD_PARTY_NOTICES.md`. Unknown or incompatible licenses stay out.
- Run `npm run typecheck`, `npm run lint`, and `npm test` before sending a change.

The app is one Node server and a React interface. Provider behavior belongs in `src/server/capabilities.ts` and `docs/provider-feasibility.md`, with the date you read the docs.
