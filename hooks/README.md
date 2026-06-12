# Hooks

Claude Code hooks are scripts that run automatically in response to events in a Claude session. They let you automate safety checks, memory persistence, formatting, and notifications without any manual prompting.

---

## Hook Events

| Event | When it fires | Common uses |
|---|---|---|
| `PreToolUse` | Before Claude uses any tool | Block dangerous commands, validate before writes |
| `PostToolUse` | After a tool completes | Auto-format, run linter, log changes |
| `UserPromptSubmit` | When you submit a message | Inject context, validate input |
| `Stop` | When Claude finishes a response | Save session memory, run cleanup |
| `PreCompact` | Before context compaction | Save important state before context shrinks |

---

## Installation

### Step 1 — Copy hook scripts to your project or globally

```bash
# Project-level
mkdir -p .claude/hooks
cp hooks/session-memory.js .claude/hooks/
cp hooks/pre-tool-guard.js .claude/hooks/

# Global (applies to all projects)
mkdir -p ~/.claude/hooks
cp hooks/*.js ~/.claude/hooks/
```

### Step 2 — Register hooks in settings.json

Add to `.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/session-memory.js"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/pre-tool-guard.js"
          }
        ]
      }
    ]
  }
}
```

See `.claude/settings.json` in this repo for a complete example.

---

## Hook Input/Output

### Input
Hooks receive a JSON object on stdin describing the event:

```json
{
  "event": "PreToolUse",
  "tool": "Bash",
  "input": {
    "command": "rm -rf dist/"
  }
}
```

### Output (PreToolUse only)
To **block** a tool call:
```json
{ "decision": "block", "reason": "Reason shown to Claude" }
```

To **allow** (or no output):
```json
{ "decision": "allow" }
```

For all other events, exit code 0 = success, non-zero = hook error (logged but doesn't block).

---

## Hooks in This Directory

### `pre-tool-guard.js` — generic, use on every project
**Event:** `PreToolUse` (Bash)

Automatically intercepts every bash command Claude tries to run and blocks a configurable list of dangerous patterns: `rm -rf /`, force pushes to main, `DROP TABLE` on non-test databases, `git clean -fd`, and others. Returns a block decision with a reason so Claude can reconsider or ask you for explicit confirmation before proceeding.

**This is the most universally useful hook here** — it adds a safety layer to every project with zero configuration needed beyond registering it in `settings.json`.

### `session-memory.js` — requires CLAUDE.md cooperation
**Event:** `Stop`

Fires when Claude finishes a response and writes a structured prompt to `.claude/session-memory-prompt.md`. **Important caveat:** hooks cannot inject content back into a session that has already stopped — they can only run shell commands. This hook works as a reminder mechanism, not a magic memory writer.

For session memory to actually work, your `CLAUDE.md` needs the corresponding instruction (already included in the universal template):

> *"At the start of each session, check if `.claude/session-memory.md` exists and read it to restore context. After any session with significant work, write a compact summary to `.claude/session-memory.md`."*

The flow is: hook fires on Stop → writes reminder file → next session Claude reads CLAUDE.md → CLAUDE.md tells Claude to check for and write the memory file. Claude does the actual writing; the hook just ensures the pattern is reinforced.

---

## How Hooks Run (Auto vs. Manual)

Once a hook is registered in `settings.json`, **Claude Code runs it automatically** — you never invoke hooks manually. There's no command to type, no skill to trigger. The runtime handles it.

- `PreToolUse` hooks run before every matching tool call — Claude waits for the hook's allow/block decision before proceeding
- `Stop` hooks run after Claude finishes each response — they're fire-and-forget (Claude doesn't wait)
- Hook failures are logged but don't crash the session

---

## Tips

- **Hooks are blocking on PreToolUse** — a slow hook adds latency to every tool call. Keep them fast (< 100ms).
- **Use absolute paths** in hook commands if running globally — relative paths are resolved from the project root.
- **Test hooks manually** before relying on them: `echo '{"event":"PreToolUse","tool":"Bash","input":{"command":"rm -rf /"}}' | node .claude/hooks/pre-tool-guard.js`
- **Hooks receive no conversation history** — they only see the event payload. Use files for any state they need to persist.
