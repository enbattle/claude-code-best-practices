# Skills

Reusable workflow definitions for Claude Code. Skills are markdown files that provide Claude with a structured workflow to follow when invoked — they're essentially reusable, named prompts with built-in process guidance.

---

## How Skills Work

Skills live in `~/.claude/skills/` (global) or `.claude/skills/` (project-level). When you type `/skill-name` in a Claude Code session, Claude loads the skill and follows its workflow.

Skills differ from agents:
- **Skills** provide a workflow — Claude follows it as the main agent
- **Agents** are specialists Claude delegates *to* — they have their own isolated context

Skills are best for repetitive workflows you run often: code reviews, TDD cycles, security checks. They save you from re-explaining the process every session.

---

## Installation

### Global install (available in all projects)
```bash
mkdir -p ~/.claude/skills
cp skills/*.md ~/.claude/skills/
```

Invoke with: `/tdd-workflow`, `/code-review`, etc.

### Project-level install (available in one project only)
```bash
mkdir -p .claude/skills
cp skills/tdd-workflow.md .claude/skills/
```

Project-level skills take precedence over global skills with the same name.

### Selective install
Copy only the skills you'll use. Unused skills don't cost context when not invoked, but keeping the directory clean reduces confusion.

---

## Skills in This Directory

| Skill | Invoked with | Best for |
|---|---|---|
| `tdd-workflow.md` | `/tdd-workflow` | Feature development with test-first discipline |
| `code-review.md` | `/code-review` | Structured self-review before opening a PR |
| `security-review.md` | `/security-review` | Pre-ship security audit |
| `verify.md` | `/verify` | Regression check after a change |

---

## Customizing Skills

Skills are plain markdown. Edit them to match your project's tech stack, test runner commands, and standards. The most useful customization is updating the commands section to match your project's actual CLI.

---

## Skill File Format

```markdown
---
description: One-line description of what this skill does (shown in /help)
---

# Skill Name

What this skill does and when to use it.

## Workflow

Step-by-step instructions Claude will follow.
```
