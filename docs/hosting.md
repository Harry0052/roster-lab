# Reaching a cloud Duet or dot

A server bound to `127.0.0.1` on a Mac is not reachable from Anthropic’s or OpenAI’s cloud. That is the safe default. Do not set `ROSTER_LAB_EXPOSE=1` on a public interface.

If Harry later connects a real provider, he needs a reachable authenticated HTTPS endpoint that he chooses:

- Anthropic’s custom-connector article says Claude connects from Anthropic’s cloud, on port 443 only, and not to a URL that names another port. A private network needs Anthropic’s published IP ranges allowed. The article names Claude, Cowork, and Claude Desktop. It does not name Duet, so this path is not established for Duet.
- OpenAI’s custom MCP guide says ChatGPT plugins can use a server URL or ChatGPT’s own “Secure MCP Tunnel”. MCP Events, documented for dots, need the server to POST a signed webhook to a callback ChatGPT supplies. That callback must be HTTPS and must not be a private address.
- A tunnel or a small VM can cost money. This project does not include a host and does not state a price.
- If the Mac sleeps or the process stops, this bridge stops. The provider’s own computer can keep running. Roster Lab will not know that unless the provider calls back.
- There is no default unauthenticated public endpoint. Bearer credentials stay in the data directory. Disconnecting here does not, by itself, revoke a session inside Claude or ChatGPT. Do that in the provider as well.

Do not put a token in a URL, a screenshot, or a chat.
