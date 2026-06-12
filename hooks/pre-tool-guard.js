#!/usr/bin/env node
/**
 * Pre-Tool Guard Hook — fires on PreToolUse for Bash commands
 *
 * Blocks dangerous commands before Claude runs them. Returns a block decision
 * with a reason so Claude can reconsider or ask the user for explicit confirmation.
 *
 * SECURITY DESIGN: This hook fails CLOSED — if it crashes or receives unexpected
 * input, it blocks the command rather than allowing it. A hook that fails open
 * provides no real protection. If the hook is blocking legitimate work due to
 * a bug, fix the hook; don't make it fail open.
 *
 * Install: register under "PreToolUse" with matcher "Bash" in .claude/settings.json
 */

const readline = require('readline')

const BLOCKED_PATTERNS = [
  // --- Destructive filesystem operations ---
  // Matches rm -rf, rm -fr, rm -Rf, rm -fR and variants, targeting dangerous paths
  {
    pattern: /\brm\b.{0,20}-[a-zA-Z]*[rR][a-zA-Z]*.{0,20}[\/~\.](\s|$)/,
    reason: 'Recursive delete targeting root, home, or current directory is irreversible. Use git rm for tracked files, or specify an exact path.',
  },
  {
    pattern: /\brm\b.{0,20}--recursive.{0,20}[\/~\.](\s|$)/,
    reason: 'Recursive delete targeting root, home, or current directory is irreversible.',
  },

  // --- Force pushes to protected branches ---
  {
    pattern: /git\s+push\b.*(?:--force|-f)\b.*\b(main|master|release|production|prod)\b/,
    reason: 'Force push to a protected branch destroys history and affects all collaborators. Use --force-with-lease after team confirmation.',
  },
  {
    pattern: /git\s+push\b.*\b(main|master|release|production|prod)\b.*(?:--force|-f)\b/,
    reason: 'Force push to a protected branch destroys history. Confirm with the team before proceeding.',
  },

  // --- Database destruction ---
  {
    pattern: /DROP\s+DATABASE\b/i,
    reason: 'DROP DATABASE is irreversible. Confirm the exact database name and that this is not a production database before running manually.',
  },
  {
    pattern: /DROP\s+TABLE\b(?!.*\b_test\b)(?!.*\btest_\b)/i,
    reason: 'DROP TABLE is irreversible. If intentional, run it manually after confirming this is not a production table.',
  },
  {
    pattern: /TRUNCATE\s+TABLE\b(?!.*\b_test\b)(?!.*\btest_\b)/i,
    reason: 'TRUNCATE permanently removes all rows. Confirm this is a non-production table and that data is not needed.',
  },

  // --- Git destructive operations ---
  {
    pattern: /git\s+reset\s+--hard\b(?!.*\bHEAD\b)/,
    reason: 'git reset --hard to a non-HEAD ref permanently discards commits. Confirm the target ref and that work is backed up.',
  },
  {
    pattern: /git\s+clean\s+.*-[a-zA-Z]*[fd]/,
    reason: 'git clean permanently deletes untracked files. Run git status first to review what will be removed.',
  },

  // --- Download and execute (supply chain risk) ---
  {
    pattern: /curl\b.*\|\s*(?:ba)?sh\b/,
    reason: 'Piping curl to bash executes untrusted remote code. Download the script first, review it, then run it explicitly.',
  },
  {
    pattern: /wget\b.*\|\s*(?:ba)?sh\b/,
    reason: 'Piping wget to bash executes untrusted remote code. Download the script first, review it, then run it explicitly.',
  },
  {
    pattern: /curl\b.*\|\s*python[0-9.]*/,
    reason: 'Piping curl to python executes untrusted remote code. Download and review the script before running.',
  },

  // --- Production environment access ---
  // Catches commands that reference production environment strings
  {
    pattern: /\bPRODUCTION_DATABASE_URL\b|\bPROD_DATABASE_URL\b|\bPROD_DB\b/,
    reason: 'This command references a production database credential. AI coding sessions must never connect to production databases. Use dev or staging credentials only.',
  },
  {
    pattern: /(?:--env|--environment|-e)\s+(?:prod|production)\b/i,
    reason: 'This command targets a production environment. AI-driven changes must target dev or staging only. Confirm this is intentional.',
  },

  // --- Cloud infrastructure deletion ---
  {
    pattern: /aws\s+.*\s+delete\b/,
    reason: 'AWS deletion commands are often irreversible. Run this manually after confirming the resource name and environment.',
  },
  {
    pattern: /aws\s+s3\s+(?:rm|delete)\b/,
    reason: 'S3 object deletion may be irreversible (no versioning on some buckets). Confirm the bucket, prefix, and environment.',
  },
  {
    pattern: /gcloud\s+.*\s+delete\b/,
    reason: 'GCP delete commands are often irreversible. Run this manually after confirming the resource and project.',
  },
  {
    pattern: /az\s+.*\s+delete\b/,
    reason: 'Azure delete commands are often irreversible. Run this manually after confirming the resource and subscription.',
  },
  {
    pattern: /terraform\s+destroy\b/,
    reason: 'terraform destroy tears down infrastructure permanently. This must be run manually with full team awareness.',
  },

  // --- Credential exposure ---
  {
    pattern: /cat\s+.*\.env\b/,
    reason: 'Printing .env files may expose secrets in session logs or transcripts. Access specific variables via the application instead.',
  },
  {
    pattern: /curl\b.*-H\s+['"]?Authorization\b.*\|\s*tee\b/,
    reason: 'Piping an authenticated request through tee may log credentials to a file or transcript.',
  },

  // --- Mass permission changes ---
  {
    pattern: /chmod\s+.*-[rR]\b.*\b[0-7]*[67][0-7][0-7]\b/,
    reason: 'Recursive permission grant to world-writable or world-executable may expose sensitive files. Confirm the intended permissions.',
  },
  {
    pattern: /chmod\s+-[rR]\s+777\b/,
    reason: 'chmod -R 777 makes files world-writable and is a significant security risk. Use the most restrictive permissions that work.',
  },
]

async function readStdin() {
  const rl = readline.createInterface({ input: process.stdin })
  let input = ''
  for await (const line of rl) {
    input += line
  }
  return input
}

function block(reason, command) {
  return JSON.stringify({
    decision: 'block',
    reason: `[pre-tool-guard] Blocked: ${reason}\n\nCommand: ${command}\n\nTo run this anyway, ask the user to explicitly confirm this specific command.`,
  })
}

function allow() {
  return JSON.stringify({ decision: 'allow' })
}

async function main() {
  let input
  try {
    input = await readStdin()
  } catch (err) {
    // Cannot read event — fail closed: block and report
    process.stderr.write(`[pre-tool-guard] Failed to read stdin: ${err.message}\n`)
    process.stdout.write(block('Hook failed to read input. Blocking as a precaution.', '(unknown)'))
    process.exit(0)
  }

  let event
  try {
    event = JSON.parse(input)
  } catch {
    // Malformed event payload — fail closed: block and report
    // An attacker who can corrupt the event payload should not bypass the guard.
    process.stderr.write('[pre-tool-guard] Received malformed JSON. Blocking as a precaution.\n')
    process.stdout.write(block('Hook received malformed event payload. Blocking as a precaution.', input.slice(0, 200)))
    process.exit(0)
  }

  // Only guard Bash PreToolUse events
  if (event.event !== 'PreToolUse' || event.tool !== 'Bash') {
    process.stdout.write(allow())
    process.exit(0)
  }

  const command = (event.input?.command || '').trim()

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      process.stdout.write(block(reason, command))
      process.exit(0)
    }
  }

  process.stdout.write(allow())
  process.exit(0)
}

// Top-level error handler — fail closed
// If anything in main() throws unexpectedly, block rather than allow.
main().catch(err => {
  process.stderr.write(`[pre-tool-guard] Unexpected error: ${err.message}\n`)
  process.stdout.write(block(`Hook encountered an unexpected error: ${err.message}. Blocking as a precaution.`, '(unknown)'))
  process.exit(0)
})
