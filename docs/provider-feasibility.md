# Provider feasibility

Read on 2026-11-20. Nothing in this file was live-tested against Harry’s accounts. “Documented” means the provider’s page said it. “Inferred” means a conclusion from those pages, not a quote. “Unknown” means the pages did not say. Third-party sites are labeled as third-party.

No earlier `Roster_Lab_Prototype.zip` was in this session. This is a fresh project.

## Claude Duet

Source: [Get started with Claude Duet](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet), fetched 2026-11-20. The page said it was updated over a week ago.

| Question | Finding | Class |
| --- | --- | --- |
| Who can use it | Research preview. Pro, Max, or Ultra. US. Waitlist or an invitation from a Duet user. Not Team or Enterprise yet. Uses the plan’s usage limits, including background work. Pro gets three limit resets during the preview; Max and Ultra get one. Unused resets expire 15 December 2026. | Documented |
| Computer | “It works on its own computer in the cloud.” You cannot watch that browser or take it over. For sites without a connector it uses that cloud browser. | Documented |
| How many Duets an app can create | The article describes one Duet on the Claude account. Separate channels share the same memory. No creation API, count, or admin API was on this page. | Documented absence of a creation API. Multiple isolated Duets: unknown, and channels are not separate computers. |
| Connectors | Duet uses connectors already connected in Claude. Named examples: Gmail, Calendar, Drive, Slack, QuickBooks, HubSpot, Docusign, Calendly, plus Stripe, Link, and Shop Pay. You start every connection. Disconnecting stops new access; memory of earlier conversations is kept. | Documented for those products |
| Custom remote MCP on Duet itself | [Custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), fetched the same day, says custom remote MCP is available on Claude, Cowork, and Claude Desktop. It does not name Duet. Claude connects from Anthropic’s cloud to public HTTPS on port 443. Auth can be OAuth or a fixed request header such as a bearer. Free plans are limited to one custom connector. | Documented for Claude, Cowork, and Desktop. Applicability to Duet: unknown. Third-party guides claim Duet inherits custom connectors; that is not this official article. |
| Wake / push | No official method was found for a third party to wake Duet or push a task. | Unknown as a feature; unsupported in this app |
| Tasks | The Tasks tab shows work and items that need you. Only the user can mark a Duet task completed. | Documented. No third-party status API was found. |
| Files | Finished work can appear in the Make tab. The article also says Duet cannot see all projects or the files on your computer. | Documented. This app cannot read that computer. |
| Cancellation | Not described for a third party. | Unknown |
| Identity | One Claude account. A bearer this app mints is not a Duet identity. | Inferred from the single-account description; not live-tested |
| Safety | Designed to ask before sending a message, paying, signing, or deleting. Prompt injection is described as a residual risk. | Documented for Duet’s own product, not for this dashboard |

## OpenAI dots

Source: [Connect computers and apps to your dot](https://learn.chatgpt.com/docs/dots/computers-and-apps), fetched 2026-11-20.

| Question | Finding | Class |
| --- | --- | --- |
| Computer | The dot lives in the cloud with its own computer and browser. State can persist. Its browser sessions are not your personal browser’s sessions. You can open the computer and take over mouse and keyboard, then return control. | Documented |
| More computers | You can connect your own computers from the ChatGPT app on each machine. A thread uses one computer at a time. The cloud computer stays connected. Local files need the computer online and the app open. | Documented for computers you connect to a dot. Not a statement that this app can provision dots. |
| How many dots | The page says “your dot”. No creation API or quota was on this page. | Unknown |
| Apps | A dot can use supported plugins installed for the account. Existing ChatGPT app permissions apply. Local skills need a connected computer. | Documented |
| Custom MCP | [Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server), fetched the same day. ChatGPT plugins support SSE and streaming HTTP. Auth options listed: OAuth, no authentication, and mixed. Write tools require confirmation by default. The page does not say “dot” in the portion retrieved. | Documented for ChatGPT plugins. That a dot runs this server’s tools: inferred from “supported plugins”, not live-tested. |
| Wake | [MCP Events](https://developers.openai.com/plugins/build/mcp-events), fetched the same day. “Available in Work chats … and with dots.” The server lists events, ChatGPT calls `events/subscribe` with a webhook URL and `whsec_` secret, and the server POSTs one signed event. Polling is not the supported delivery. Private callback addresses are to be blocked. | Documented. Not live-tested here. Public GitHub reports (not reproduced here) say a dot run can start without the event `data`. |
| Cancellation, files, per-dot identity for a third-party app | Not established by the pages above. | Unknown |
| Plan eligibility for Harry | Not stated as a single rule on the computers page. A desktop annotation feature on that page is described as rolling out for Pro, Business Premium, and Enterprise. That sentence is about annotations, not proof of who can have a dot. | Unknown for Harry’s account |

## Grok Bot, for contrast only

Source: [Grok Bot for teams and enterprises](https://docs.x.ai/grok-bot/teams-and-enterprises), fetched 2026-11-20.

Documented: each user has a dedicated Firecracker microVM. All of that user’s Bots share that one computer. Bots isolate personalities and workspaces, not compute. A separate computer means a separate Cursor user. This is not a Duet or a dot, and it does not satisfy Harry’s requirement by itself.

## Open-source comparison

Checked 2026-11-20. No code was copied.

| Project | What it is | License and maintenance signals observed | Overlap | Decision |
| --- | --- | --- | --- | --- |
| [Paperclip](https://github.com/paperclipai/paperclip) | Node and React app that orchestrates agents you bring (Claude Code, Codex, Cursor, and others). Company goals, budgets, governance. | GitHub API: MIT. Pushed 2026-11-20. The API reported 115204 stars. Language TypeScript. | Tasks, people, approvals, a dashboard. It does not provide Duet or dot computers. | Ideas only. Not a dependency. |
| [dots-bridge](https://github.com/uezo/dots-bridge) | Unofficial Python bridge. Its README says it uses HTTP and MCP Events, needs a public HTTPS URL, and is not endorsed by OpenAI. | GitHub API: MIT. Pushed 2026-10-22. The API reported 7 stars and 1 fork. | A pattern for talking to a dot the user already has. | Documented only. Not vendored, not a dependency. Not proof of two computers. |
| [bud-relay](https://pypi.org/project/bud-relay/) 0.2.1 | Unofficial MCP mailbox. Its own page says Duet cannot be woken, a dot can be woken through MCP Events, and it is not affiliated with the vendors. | PyPI: MIT. Version 0.2.1 uploaded 2026-11-05. | Cross-agent messages. | Not run and not copied. Its wake claims are the project’s claims, not ours. |

## Hard blockers

1. No documented, permitted API was found to create many isolated Duets or dots, or to provision a computer per employee from this app.
2. Duet channels share memory, so extra channels would not meet the separate-computer rule even if they were available.
3. Official custom-connector docs do not name Duet. Treating “it works in Claude” as “it works in Duet” is not allowed by the blueprint.
4. Duet has no documented wake. A task queued here waits until something calls in.
5. Dot wake via MCP Events is documented but was not exercised, and this build does not implement the OAuth sign-in the ChatGPT plugin form documents. A static bearer is closer to Anthropic’s request-header option than to that plugin form.
6. No eligible account was available, so live behavior and isolation are unverified.

## Choices, unchanged from the blueprint

1. Keep the goal and wait until Duet and dots expose the missing provisioning, messaging, and isolation.
2. Use only as many real Duet or dot computers as the providers and Harry’s authorized accounts actually allow, with that limit shown.
3. A different product of user-managed machines plus model APIs or local models, only if Harry explicitly approves it. Those workers would not be Duets or dots, and they can add cost or hardware.

This build does not take option 3.
