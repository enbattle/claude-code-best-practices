# CI/CD Rules

CI/CD is the delivery mechanism for everything this repo's other rules produce. A pipeline that passes bad code, breaks silently, or deploys dangerously undermines every other quality gate. These rules describe the pipeline structure and deployment practices used at well-run engineering organizations.

---

## Pipeline Structure

Every CI pipeline runs these stages in order. A failure in any stage stops the pipeline — later stages don't run on broken code.

```
lint → type-check → test → build → deploy
```

| Stage | What it catches | Should take |
|---|---|---|
| `lint` | Style violations, obvious errors, import issues | < 1 min |
| `type-check` | Type errors, contract violations | < 2 min |
| `test` | Behavior regressions, broken logic | 2–10 min |
| `build` | Build errors, bundle issues, missing assets | 2–5 min |
| `deploy` | Deployment errors, infrastructure problems | Varies |

**Never skip stages to make the pipeline faster.** If the pipeline is too slow, optimize within stages (caching, parallelism) — don't remove gates.

### Fail fast

Put the cheapest checks first. Lint takes 30 seconds and catches many issues; running it before a 5-minute test suite means failures are caught faster and runners are freed sooner.

```yaml
# GitHub Actions example — lint runs first, blocks test
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm lint

  test:
    needs: lint          # only runs if lint passes
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test
```

---

## Quality Gates

These checks must pass before any code merges to the main branch. They are not suggestions — they are enforced by CI and branch protection.

### Required gates

| Gate | Standard |
|---|---|
| Lint | Zero warnings, zero errors |
| Type check | Zero type errors |
| Unit tests | 100% pass rate |
| Test coverage | ≥ 80% for business logic (configurable per project) |
| Build | Successful build for all target environments |
| Security scan | No critical or high CVEs in dependencies |

### Coverage that doesn't get enforced is not coverage

Configure coverage enforcement in CI, not just as a report:

```yaml
# Jest — fail if coverage drops
jest --coverage --coverageThreshold='{"global":{"lines":80,"branches":75}}'
```

```python
# pytest — fail if coverage drops
pytest --cov=src --cov-fail-under=80
```

---

## Branch Protection

Every project's main branch must have these protections enabled. These are non-negotiable for any team with more than one person.

- Require pull request before merging (no direct pushes to main)
- Require CI checks to pass before merge
- Require at least one approving review for changes to: auth, payments, data schema, infrastructure
- Dismiss stale reviews when new commits are pushed
- Require branches to be up to date before merging (prevents "worked on my machine, failed in CI")

### Special protections for sensitive paths

Some changes carry extra risk. For these, require two approving reviews:
- Changes to authentication or authorization logic
- Changes to payment processing
- Database schema changes
- Changes to CI/CD pipeline configuration itself
- Changes to IAM policies or infrastructure

---

## Secrets in CI

### Never put secrets in CI configuration files

CI config files (`*.yml`, `Dockerfile`, `Makefile`) are committed to source control. They must never contain secrets.

```yaml
# Bad — secret in config file
- run: curl -H "Authorization: Bearer sk-live-abc123" api.example.com

# Good — secret from environment
- run: curl -H "Authorization: Bearer ${{ secrets.API_KEY }}" api.example.com
```

### Use your CI provider's secret storage

GitHub Actions: `Settings → Secrets and Variables → Actions`  
GitLab CI: `Settings → CI/CD → Variables`  
CircleCI: `Project Settings → Environment Variables`

Secrets stored this way are:
- Encrypted at rest
- Masked in CI logs (replaced with `***`)
- Available to jobs without appearing in config

### Separate secrets per environment

Use different credentials for CI (test environment) than for production. CI secrets should:
- Connect to a test/staging database, not production
- Have minimal permissions (read-only where possible)
- Be rotated on a schedule (quarterly minimum)
- Be revoked immediately if a repo or CI system is compromised

---

## Deployment Strategies

### Blue/Green deployment

Two identical environments: one live (blue), one idle (green). Deploy to green, test it, then switch traffic. If something breaks, switch back — rollback is instant.

```
Traffic: 100% → blue
   ↓ deploy to green, run smoke tests
Traffic: 100% → green
   ↓ if problem detected
Traffic: 100% → blue (instant rollback)
```

**Best for:** high-traffic applications where downtime is unacceptable. Requires double the infrastructure during deployment windows.

### Canary deployment

Route a small percentage of traffic to the new version. Gradually increase as confidence grows. Rollback by setting the canary percentage back to 0%.

```
Traffic: 100% → v1
   ↓ deploy v2
Traffic: 5% → v2, 95% → v1
   ↓ after 10 minutes, error rate acceptable
Traffic: 25% → v2, 75% → v1
   ↓ after 30 minutes, metrics good
Traffic: 100% → v2
```

**Best for:** detecting regressions that only appear under real traffic, gradual rollout of feature changes.

### Rolling deployment

Replace instances one-at-a-time rather than all at once. At any point during the deployment, some instances run the old version and some run the new version.

**Constraint:** old and new versions must be able to run simultaneously. This means: backwards-compatible database changes, backwards-compatible APIs. Any breaking change requires a two-phase deploy.

### When to use each

| Strategy | Use when |
|---|---|
| Blue/green | Zero-downtime is required, infrastructure budget allows |
| Canary | Catching production-only regressions matters more than deploy speed |
| Rolling | Infrastructure is limited; old/new compatibility is guaranteed |

---

## Rollback Triggers

Define rollback triggers before you deploy. Don't decide during an incident — you're too stressed to think clearly.

### Automatic rollback triggers

Configure your deployment tool to automatically rollback if any of these are exceeded within 10 minutes of deploy:

- Error rate increases > 1% above pre-deploy baseline
- p99 latency increases > 50% above pre-deploy baseline
- Health check failure rate > 5%
- Any uncaught exception type that didn't exist before the deploy

### Manual rollback criteria

Page on-call and rollback immediately if:
- Any critical functionality is broken for >5 minutes
- Data integrity issues are detected
- Security vulnerability is discovered in the deployed code

### Rollback must be practiced

Run a rollback drill quarterly. If you've never rolled back before an incident, you will make mistakes during one.

---

## Environment Promotion

Code moves through environments in one direction: `dev → staging → production`. It never skips stages.

```
Feature branch → main → staging → production
```

### Environment parity

Staging must mirror production in:
- Infrastructure shape (same service topology, same cloud provider)
- Data model (same schema, though different data)
- Configuration (same environment variable names, different values)
- Dependencies (same versions of external services)

The most common "worked in staging, broke in prod" failures come from staging using different DB versions, different cache configurations, or different secret values.

### Never test in production

Production is for production traffic. All testing — including smoke tests and health checks — runs against staging or a pre-production environment. The only thing running against production is production traffic and monitoring.

---

## Preview Deployments

For frontend or full-stack projects, deploy every pull request to a unique preview URL automatically. Preview deployments:

- Let reviewers test UI changes without checking out the branch
- Catch environment-specific issues before merge
- Make QA possible without a shared staging environment

Tools: Vercel preview deployments, Netlify deploy previews, Railway preview environments.

**Don't connect preview deployments to production databases or services.** Use a shared staging database or per-PR databases.

---

## CI Pipeline as Code

The pipeline is code. Treat it that way.

- Pipeline configuration lives in the repo alongside the code it builds
- Changes to pipeline config go through the same PR process as code changes
- Pin action/orb/image versions to prevent silent pipeline changes
- Review pipeline changes for: new credentials required, new permissions granted, changes to deployment targets

```yaml
# Bad — unpinned, can change any day
uses: actions/checkout@main

# Good — pinned to a specific commit SHA or version tag
uses: actions/checkout@v4
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
```

---

## Build Artifacts

- Build once, deploy to multiple environments — never rebuild for each environment
- The same artifact that passed tests in staging is what gets deployed to production
- Store artifacts in a registry or object store (not in the git repo)
- Tag artifacts with the commit SHA so you can trace every production deployment back to exact source code

```bash
# Build and tag with commit SHA
docker build -t myapp:${GITHUB_SHA} .
docker push myapp:${GITHUB_SHA}

# Deploy to staging and then promote the exact same image to production
kubectl set image deployment/app app=myapp:${GITHUB_SHA}
```
