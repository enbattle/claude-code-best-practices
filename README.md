# Claude Code Best Practices

A curated library of CLAUDE.md templates, rules, agents, skills, and hooks for building enterprise-grade applications with Claude Code and other AI coding agents.

**Signal over noise.** Every file in this repo earns its place. No 262-skill bloat, no cross-harness adapter sprawl — just the configurations that actually move the needle on code quality, security, and team consistency.

---

## How to Use This Repo

**The right approach is hybrid.** Not everything should be copied into every project, and not everything should stay only as a shared reference. Here's exactly how to use each layer — do the one-time setup once, then follow the per-project steps for every new codebase you start.

### Step 1 — One-time global setup

Do this once on your machine. These files work across all your projects from a single install.

**Install skills globally** — skills are invoked by name (`/tdd-workflow`, `/verify`) from any project. Install them once and they're always available.
```bash
mkdir -p ~/.claude/skills
cp skills/*.md ~/.claude/skills/
```

**Install hooks globally** — the hook scripts live globally; each project's `settings.json` just points at them.
```bash
mkdir -p ~/.claude/hooks
cp hooks/*.js ~/.claude/hooks/
```

**Point an MCP server at this repo** — add this to your global `~/.claude/settings.json`. This lets Claude look up rules, templates, and examples from this library in any project session, without you ever copying those files into a project.
```json
{
  "mcpServers": {
    "best-practices": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/this/repo"
      ]
    }
  }
}
```
> Replace `/path/to/this/repo` with the absolute path to your local clone of this repo.

### Step 2 — Per-project setup

Do this each time you start a new project. These three things belong in every project's codebase.

**Copy and fill in CLAUDE.md** — this is the one file that must live inside each project. It's project-specific context: your stack, your directory structure, your exact commands. Use the universal template or pick the closest match from `templates/`.
```bash
# Pick one:
cp CLAUDE.md /your/project/CLAUDE.md
cp templates/fullstack-web.md /your/project/CLAUDE.md
cp templates/python-api.md /your/project/CLAUDE.md
```
> **Using an AI assistant to fill it in?** Paste the file into your AI chat and say: *"Fill in all the FILL IN placeholders based on this project's codebase."* Claude, Cursor, Copilot, and most modern coding agents can read your project structure and populate every section automatically.

**Copy 2–3 relevant agents** — agents live inside the project repo in `.claude/agents/`. Pick the ones that fit: `planner` and `code-reviewer` work for almost every project.
```bash
mkdir -p /your/project/.claude/agents
cp agents/planner.md /your/project/.claude/agents/
cp agents/code-reviewer.md /your/project/.claude/agents/
# add security-reviewer.md for auth/payment work, architect.md for complex systems
```

**Copy and configure settings.json** — sets permissions, wires up the globally-installed hooks, and holds any project-specific MCP configs.
```bash
cp .claude/settings.json /your/project/.claude/settings.json
```

### What stays in this repo (don't copy into projects)

| Layer | Why it stays here |
|---|---|
| `rules/` | Reference via the MCP server above. Copying creates drift — each project's copy diverges over time as you update the shared source. |
| `templates/` | Consult when bootstrapping, not a project artifact. |
| `mcp/` configs | Paste the snippets you need into your project's `settings.json`; the source stays here. |
| `skills/` and `hooks/` | Already globally installed in Step 1. No need to duplicate. |

---

## Why This Exists

Most AI coding setups are either too bare (a 3-line CLAUDE.md) or too heavy (install scripts, 64 agents, plugin managers). This repo occupies the space in between: the configurations that a senior engineer at a well-run tech company would actually commit to a repo and maintain over time.

Three principles guide every file here:

1. **Context is a budget.** Your 200k token context window shrinks fast — every enabled MCP, every rule file, every active tool costs tokens. Fewer, higher-quality constraints outperform more of them every time.

2. **Own your config.** Files you understand and control are more durable than plugins you depend on. Everything here is plain markdown or plain JS — no build steps, no lock-in.

3. **The why matters more than the what.** Rules without reasoning get ignored or worked around. Every rule in this repo exists because of a real failure mode it prevents.

---

## Repo Structure

```
claude-code-best-practices/
│
├── CLAUDE.md                    ← Universal template (start here)
│
├── templates/                   ← Opinionated templates per project type
│   ├── fullstack-web.md        ← Next.js / React / TypeScript
│   ├── python-api.md           ← FastAPI / Django / Flask
│   ├── go-service.md           ← Go microservices
│   ├── mobile.md               ← React Native / Flutter
│   └── data-ml.md              ← Python data science / ML
│
├── rules/                       ← Modular rules, @-importable into any CLAUDE.md
│   ├── coding-style.md         ← Immutability, naming, structure
│   ├── security.md             ← Pre-commit checklist, secret management
│   ├── testing.md              ← TDD, coverage, test structure
│   ├── git-workflow.md         ← Commit format, PR standards
│   ├── performance.md          ← Query, bundle, cache patterns
│   └── api-design.md           ← REST conventions, status codes, versioning
│
├── agents/                      ← Subagent definitions → .claude/agents/
│   ├── README.md               ← How to install and when to use each
│   ├── planner.md              ← Feature planning specialist
│   ├── architect.md            ← Architecture review specialist
│   ├── code-reviewer.md        ← Code review specialist
│   └── security-reviewer.md   ← Security audit specialist
│
├── skills/                      ← Reusable workflows → ~/.claude/skills/
│   ├── README.md               ← Global vs project-level install guide
│   ├── tdd-workflow.md         ← Red-green-refactor loop
│   ├── code-review.md          ← Structured code review
│   ├── security-review.md      ← Security audit workflow
│   └── verify.md               ← Verification and regression check
│
├── hooks/                       ← Automation scripts → .claude/hooks/
│   ├── README.md               ← Event types and settings.json wiring
│   ├── session-memory.js       ← Persist context across sessions
│   └── pre-tool-guard.js       ← Block dangerous operations
│
├── mcp/                         ← MCP server config snippets
│   ├── README.md               ← Context cost warning + enable/disable guidance
│   ├── github.json
│   ├── filesystem.json
│   └── supabase.json
│
├── .claude/
│   └── settings.json           ← Recommended Claude Code settings template
│
└── examples/                    ← Complete working configurations
    ├── nextjs-saas/            ← Full Next.js SaaS project setup
    └── python-api/             ← Full Python API project setup
```

---

## Sizing Guide

Not every project needs every layer. Here's how to think about what to enable:

| Layer | Cost | When to add |
|---|---|---|
| `CLAUDE.md` | Minimal (always loaded) | Every project, always |
| `rules/` | Low (loaded on reference) | When you have a team or need consistency |
| `agents/` | Zero (only active when invoked) | When tasks are complex enough to delegate |
| `skills/` | Zero (only active when invoked) | When you repeat the same workflow often |
| Hooks | Low (run on events) | When you need automation or safety gates |
| MCP servers | Medium–High (tools count toward context) | Only enable what the current task needs |

**Rule of thumb for MCPs:** Configure many, enable few. Keep under 10 active per session. The context cost of an unused MCP is still real.

---

## Context Economics

This is the mental model that makes the difference between a setup that helps and one that fights you:

Your context window is approximately 200k tokens, but that budget erodes before you even start:
- Each enabled MCP server adds tool definitions (hundreds of tokens each)
- Each loaded rule file occupies context
- Large CLAUDE.md files reduce the space available for actual code

The implication: **a CLAUDE.md that's too long or rules that are too verbose actually make Claude worse**, not better. Aim for density — every sentence should earn its place.

A well-tuned setup looks like:
- CLAUDE.md: 300–600 lines covering only project-specific context
- Rules: modular files @-imported on demand, not all loaded at once
- MCPs: 15+ configured in settings, 5–6 enabled at any time
- Agents: defined for specialization, invoked for complex tasks only

---

## Works With Other Agents

The `CLAUDE.md` format and `rules/` structure work across AI coding tools, not just Claude Code:

- **Cursor** — CLAUDE.md maps directly to `.cursorrules` or the system prompt in Cursor settings
- **Windsurf** — Compatible with `.windsurfrules`
- **GitHub Copilot** — Core rules can be adapted into `.github/copilot-instructions.md`
- **Gemini CLI / Codex** — CLAUDE.md structure is understood by most modern coding agents

The agents and skills directories are Claude Code-specific, but the underlying markdown content is portable — you can adapt any agent or skill as a prompt for other tools.

---

## Contributing

This repo is intentionally lean. Before adding a file, ask: would a senior engineer at a well-run company commit this to their project? If yes — open a PR. If it's framework-specific boilerplate that only 2% of projects need, it probably belongs in a fork, not here.

Good additions:
- Rules that encode hard-won lessons from production failures
- Templates for widely-used project types not yet covered
- Agent definitions that solve a real delegation problem
- Hook scripts with a concrete safety or automation use case

Format: follow the existing style. No install scripts, no plugin dependencies, no GUIs.
