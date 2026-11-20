# Third-party notices

Original Roster Lab code is MIT, copyright Harry Malhi. The packages below are installed from npm and locked in `package-lock.json`. Their own licenses apply. None of Paperclip, dots-bridge, or bud-relay is vendored or depended on. They are compared in `docs/provider-feasibility.md`.

| Package | Role | License as published with the package |
| --- | --- | --- |
| react, react-dom | Interface | MIT |
| vite, @vitejs/plugin-react | Dev server and build | MIT |
| tailwindcss, @tailwindcss/vite, tailwind-merge | Styling | MIT |
| class-variance-authority | Button variants | Apache-2.0 |
| clsx | Class names | MIT |
| typescript | Types | Apache-2.0 |
| tsx | Run TypeScript | MIT |
| @biomejs/biome | Lint | MIT OR Apache-2.0 |
| @types/react, @types/react-dom, @types/node | Types | MIT |

Node.js supplies `node:sqlite`. It is part of Node, not an npm dependency. Node 22 marks it experimental.

The button component uses `class-variance-authority` in a pattern popularized by shadcn/ui (MIT). No shadcn source file was copied. Colors and copy are original.

No prototype archive was supplied, so nothing from an earlier zip is included.
