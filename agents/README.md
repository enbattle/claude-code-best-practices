# Agents

Custom subagent definitions for Claude Code. Each agent is a specialist that handles a specific type of task with a narrower scope than the main agent — which means less context usage, more focused output, and better results for complex work.

---

## How Agents Work

Agents in Claude Code are markdown files stored in `.claude/agents/`. When the main agent decides to delegate, it spawns the subagent with its own context window and the permissions defined in the agent file.

Key properties:
- Each agent has its own isolated context — it doesn't share the main conversation history
- You can restrict which tools an agent can use (e.g., a reviewer that can only read, not write)
- Agents can be invoked explicitly ("use the planner agent") or automatically based on the task
- The `description` frontmatter field is what Claude reads to decide when to auto-invoke

---

## Installation

### Project-level (applies to one project)
```bash
mkdir -p .claude/agents
cp agents/planner.md .claude/agents/
cp agents/code-reviewer.md .claude/agents/
# add whichever agents you need
```

### Global (applies to all your projects)
```bash
mkdir -p ~/.claude/agents
cp agents/*.md ~/.claude/agents/
```

Project-level agents take precedence over global agents with the same name.

---

## Agents in This Directory

| Agent | Best for | Invoke when |
|---|---|---|
| `planner.md` | Feature planning, task decomposition | Before writing code for anything that touches 3+ files |
| `architect.md` | Architecture decisions, design review | Evaluating structural changes or new service design |
| `code-reviewer.md` | Code review, quality feedback | After implementing a feature, before a PR |
| `security-reviewer.md` | Security audits, vulnerability check | Before any auth/payment/data change ships |
| `debugger.md` | Root-cause analysis, incident post-mortems | When a bug's cause is unclear or a fix attempt has failed |

---

## Agent Design Principles

**Small scope beats large scope.** An agent with 5 focused tools does better work than one with 20 tools. Every additional tool costs context and introduces decision overhead.

**Read-only agents are safe agents.** Reviewer and auditor agents should only have `Read` and `Bash` (read-only commands). They should not be able to write or delete files.

**The description field is the routing key.** Write the `description` to be specific enough that Claude invokes the right agent automatically. Vague descriptions cause misrouting.

---

## Customizing Agents

Each agent file follows this format:

```markdown
---
name: agent-name
description: When Claude should invoke this agent. Be specific about triggers.
tools: Read, Bash, Edit, Write   # comma-separated, omit to allow all tools
---

# Agent instructions
The system prompt for this agent goes here.
```

Modify the instructions section to match your project's conventions, tech stack, and standards. The more project-specific the agent, the better it performs.
