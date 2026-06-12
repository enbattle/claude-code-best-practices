# Git Workflow Rules

## Commit Message Format

```
<type>(<optional scope>): <short description>

[optional body — explain WHY, not what]

[optional footer — issue refs, breaking changes]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature visible to users |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't add features or fix bugs |
| `test` | Adding or updating tests only |
| `docs` | Documentation only |
| `chore` | Maintenance — dependency updates, build config, tooling |
| `perf` | Performance improvement |
| `ci` | CI/CD configuration changes |

### Subject line rules
- 72 characters maximum
- Imperative mood: "add retry logic" not "added retry logic" or "adds retry logic"
- No period at the end
- Lowercase after the colon
- Be specific: "fix null pointer in user auth middleware" not "fix bug"

### Body (optional but encouraged for non-trivial changes)
Explain **why** the change was made, not what changed. The diff shows what changed. The commit body answers: what was wrong, why this approach was chosen, what trade-offs were made.

```
feat(auth): add refresh token rotation

Short-lived access tokens (15min) reduce the window of exposure if a 
token is stolen. Refresh tokens are rotated on each use and invalidated 
on logout to prevent replay attacks.

Breaking change: clients must now handle 401s by calling /auth/refresh
before retrying. The old behavior of long-lived access tokens is removed.

Closes #247
```

---

## Branch Naming

```
<type>/<short-description>
```

Examples:
```
feat/user-profile-page
fix/null-session-on-logout
refactor/extract-payment-service
chore/upgrade-to-node-20
```

Rules:
- Use kebab-case
- Keep it short (3–5 words)
- Match the commit type prefix
- Never work directly on `main` or `master`

---

## Working on a Branch

1. Branch from the latest `main`: `git checkout -b feat/my-feature origin/main`
2. Make small, focused commits — one logical change per commit
3. Don't bundle unrelated changes in a single commit or PR
4. Rebase on `main` before opening a PR if the branch is more than a day old
5. Run tests and the linter before pushing

---

## Pull Request Standards

### PR size
- Aim for PRs under 400 lines changed
- Large PRs get worse reviews — split features into sequential PRs if possible
- Refactoring PRs should be separate from behavior-change PRs

### PR description
Every PR description must include:

1. **What** — A one-line summary of the change (can be the same as the commit subject)
2. **Why** — The motivation: what problem does this solve, what was wrong before?
3. **How** — For non-obvious implementations, explain the approach and alternatives considered
4. **Testing** — How was this tested? What test cases were added?

### PR checklist before requesting review
- [ ] Tests pass locally
- [ ] Type checker passes
- [ ] Linter passes
- [ ] New tests added for new behavior
- [ ] No unrelated changes bundled in
- [ ] PR description filled out
- [ ] Self-reviewed the diff

---

## Code Review Standards

### For reviewers
- Review within 24 hours (business hours) on active projects
- Distinguish blocking feedback from suggestions: prefix with `nit:` or `suggestion:` for non-blocking
- Approve when the code is correct and safe, not when it's perfect
- Ask questions to understand before assuming a mistake: "Is this intentional? I'd expect..."

### For authors
- Respond to every comment — either make the change or explain why you disagree
- Don't silently dismiss feedback
- If a discussion runs more than 3 comments, move it to a call or Slack

### Merge requirements
- All CI checks passing
- At minimum 1 approval for most changes
- 2 approvals for: auth changes, payment flows, data schema migrations, security-related code
- Author does not merge their own PR — a reviewer merges after approval

---

## Merging Strategy

### Preferred: Squash and merge
- Keeps `main` history linear and readable
- One PR = one commit on `main`
- Requires good PR titles (they become the commit message on `main`)

### When to use merge commit
- For long-running feature branches where the individual commits tell an important story
- When merging a release branch back to `main`

### Never
- Force-push to `main`
- Bypass branch protection rules
- Merge without CI passing
- Merge your own PR without another reviewer

---

## Commit Hygiene

### Atomic commits
Each commit should represent one complete, logical change. It should pass tests on its own. A reviewer should be able to understand the change from the commit message and diff alone.

### What not to commit
- `.env` files or any file containing secrets
- Generated files that aren't needed in the repo (build artifacts, dist, .pyc)
- Editor config files specific to your setup (`.vscode/settings.json` with personal settings)
- Debug code, `console.log`, `print` statements added during development

### Keeping history clean
- Don't commit merge commits from `git pull` — use `git pull --rebase` or configure `pull.rebase = true`
- Fix up typos and small mistakes with `git commit --amend` before pushing
- After pushing, don't amend — create a new commit instead

---

## Tags and Releases

```bash
# Create an annotated tag for releases
git tag -a v1.2.3 -m "Release v1.2.3: add user profile feature"

# Push tags
git push origin v1.2.3
```

Use semantic versioning: `MAJOR.MINOR.PATCH`
- `MAJOR`: breaking API change
- `MINOR`: new backward-compatible feature
- `PATCH`: backward-compatible bug fix
