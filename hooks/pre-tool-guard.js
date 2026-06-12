#!/usr/bin/env node
/**
 * Pre-Tool Guard Hook — fires on PreToolUse for Bash commands
 *
 * Blocks a configurable list of dangerous commands before Claude runs them.
 * Returns a block decision with a reason so Claude can reconsider or ask
 * the user for explicit confirmation.
 *
 * Install: register under "PreToolUse" with matcher "Bash" in .claude/settings.json
 * Usage: node .claude/hooks/pre-tool-guard.js
 */

const readline = require('readline')

// Commands that should never run without explicit user confirmation.
// Add patterns specific to your project as needed.
const BLOCKED_PATTERNS = [
  // Destructive filesystem operations
  { pattern: /rm\s+-rf\s+\/(?!\s*$)/, reason: 'Recursive delete from root is irreversible. Use a more specific path.' },
  { pattern: /rm\s+-rf\s+~\//, reason: 'Recursive delete from home directory is irreversible.' },
  { pattern: /rm\s+-rf\s+\.\s*$/, reason: 'Recursive delete of current directory is irreversible.' },

  // Force pushes to protected branches
  { pattern: /git\s+push\s+.*--force\s+.*(?:origin\s+)?main/, reason: 'Force push to main can destroy history. Use --force-with-lease and confirm with the team.' },
  { pattern: /git\s+push\s+.*--force\s+.*(?:origin\s+)?master/, reason: 'Force push to master can destroy history.' },
  { pattern: /git\s+push\s+.*-f\s+.*(?:origin\s+)?main/, reason: 'Force push to main can destroy history.' },

  // Database destruction
  { pattern: /DROP\s+DATABASE/i, reason: 'DROP DATABASE is irreversible. Run this manually after confirming the database name.' },
  { pattern: /DROP\s+TABLE\s+(?!.*_test)/i, reason: 'DROP TABLE is irreversible. If this is intentional, run it manually.' },
  { pattern: /TRUNCATE\s+TABLE\s+(?!.*_test)/i, reason: 'TRUNCATE TABLE is irreversible on production data. Confirm this is the test database.' },

  // Hard resets
  { pattern: /git\s+reset\s+--hard\s+(?!HEAD)/, reason: 'git reset --hard to a non-HEAD ref can permanently discard commits. Confirm this is intended.' },
  { pattern: /git\s+clean\s+-fd/, reason: 'git clean -fd permanently deletes untracked files. Use git status first to review what will be removed.' },

  // Credential exposure
  { pattern: /curl.*-H.*Authorization.*\|.*tee/, reason: 'Piping a request with an Authorization header to tee may log credentials.' },
  { pattern: /cat\s+.*\.env(?:\s|$)/, reason: 'Printing .env files may expose secrets in logs or transcripts.' },
]

async function main() {
  const rl = readline.createInterface({ input: process.stdin })
  let input = ''
  for await (const line of rl) {
    input += line
  }

  let event = {}
  try {
    event = JSON.parse(input)
  } catch {
    // Invalid JSON — allow the operation to proceed
    process.stdout.write(JSON.stringify({ decision: 'allow' }))
    process.exit(0)
  }

  // Only guard Bash PreToolUse events
  if (event.event !== 'PreToolUse' || event.tool !== 'Bash') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }))
    process.exit(0)
  }

  const command = (event.input?.command || '').trim()

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      const response = {
        decision: 'block',
        reason: `[pre-tool-guard] Blocked: ${reason}\n\nCommand was: ${command}\n\nTo run this anyway, the user must explicitly confirm by asking you to proceed with this specific command.`,
      }
      process.stdout.write(JSON.stringify(response))
      process.exit(0)
    }
  }

  // Allow all other commands
  process.stdout.write(JSON.stringify({ decision: 'allow' }))
  process.exit(0)
}

main().catch(err => {
  process.stderr.write(`[pre-tool-guard] Error: ${err.message}\n`)
  // On hook error, allow the operation — don't block legitimate work due to hook bugs
  process.stdout.write(JSON.stringify({ decision: 'allow' }))
  process.exit(0)
})
