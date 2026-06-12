#!/usr/bin/env node
/**
 * Session Memory Hook — fires on the Stop event
 *
 * Reads stdin for the session event, then prompts Claude to write a compact
 * session summary to .claude/session-memory.md. On the next session start,
 * Claude can read this file to restore context.
 *
 * Install: register under "Stop" in .claude/settings.json
 * Usage: node .claude/hooks/session-memory.js
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const MEMORY_FILE = path.join(process.cwd(), '.claude', 'session-memory.md')
const MEMORY_DIR = path.dirname(MEMORY_FILE)

async function main() {
  // Read event payload from stdin
  const rl = readline.createInterface({ input: process.stdin })
  let input = ''
  for await (const line of rl) {
    input += line
  }

  let event = {}
  try {
    event = JSON.parse(input)
  } catch {
    // No valid JSON — proceed anyway
  }

  // Only act on Stop events
  if (event.event !== 'Stop') {
    process.exit(0)
  }

  // Ensure the .claude directory exists
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString()

  // Write a prompt to stdout that Claude will see after this hook runs.
  // Claude will then write the actual memory file content.
  const prompt = `
<!-- SESSION MEMORY HOOK -->
Please update .claude/session-memory.md with a compact summary of this session.
Use this exact format:

---
last_updated: ${timestamp}
---

## Last Session Summary
[2-4 sentences: what was worked on, key decisions made, current state]

## In Progress
[Bullet list of any tasks that were started but not completed]

## Key Context
[Bullet list of non-obvious facts discovered this session that future sessions should know]

## Next Steps
[Bullet list of what should happen next, if known]
---

Keep it under 50 lines. This file is read at the start of each session to restore context.
`

  // Output the prompt as a suggestion to Claude via stderr (informational)
  process.stderr.write(`[session-memory] Session ended at ${timestamp}. Writing memory prompt.\n`)

  // Write the memory prompt as a file Claude can reference
  const promptFile = path.join(MEMORY_DIR, 'session-memory-prompt.md')
  fs.writeFileSync(promptFile, prompt.trim())

  process.exit(0)
}

main().catch(err => {
  process.stderr.write(`[session-memory] Error: ${err.message}\n`)
  process.exit(1)
})
