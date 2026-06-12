# MCP Servers

Model Context Protocol (MCP) servers extend Claude Code with additional tools — GitHub integration, database access, browser automation, and more.

---

## Context Window Cost Warning

**Every enabled MCP server costs context tokens**, even if you never use its tools. Each server registers its tool definitions into your context window at the start of every session.

A typical MCP server adds 500–2,000 tokens of tool definitions. With 10 servers enabled, that's 5,000–20,000 tokens consumed before you write a single line of code.

**The right model:**
- **Configure** many servers in settings (free — they're just listed)
- **Enable** only the ones you need for the current session (toggle in Claude Code UI)
- **Target:** 5–8 enabled servers per session maximum

If Claude seems to be forgetting context or losing coherence on long tasks, the first thing to check is how many MCPs are active.

---

## Configuration Format

MCP server configs go in `mcpServers` in your `settings.json`:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@package/name"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      }
    }
  }
}
```

Environment variables use `${VAR_NAME}` syntax — they're read from your shell environment, not hardcoded.

---

## Server Configs in This Directory

| File | Server | Provides |
|---|---|---|
| `github.json` | GitHub MCP | Read/write issues, PRs, code, workflows |
| `filesystem.json` | Filesystem MCP | Explicit file system access beyond the project root |
| `supabase.json` | Supabase MCP | Query Supabase DB, manage tables, Edge Functions |

---

## Installing MCP Servers

Paste the relevant config snippet into the `mcpServers` section of:
- `~/.claude/settings.json` — global (all projects)
- `.claude/settings.json` — project-level (this project only)

See `.claude/settings.json` in this repo for the complete settings structure.

---

## Other Recommended Servers

These aren't included as files here because they're highly team/workflow-specific, but are widely useful:

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/server-postgres` | Direct PostgreSQL query access |
| `@modelcontextprotocol/server-brave-search` | Web search within Claude sessions |
| `@playwright/mcp` | Browser automation and screenshot capture |
| `mcp-server-vercel` | Vercel deployments and log access |
| `mcp-server-linear` | Linear issue management |
| `mcp-server-slack` | Slack message reading (for context) |

Install via `npx -y <package-name>` in the `command`/`args` format shown in the config files.
