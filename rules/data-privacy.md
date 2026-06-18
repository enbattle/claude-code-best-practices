# Data Privacy Rules

Data privacy is not a legal compliance checkbox — it's an engineering discipline. The cost of a data breach or a GDPR enforcement action far exceeds the cost of building privacy in from the start. These rules encode the practices that prevent both.

This file covers: data classification, minimization, retention, user rights, anonymization, consent, and audit trails. See `rules/security.md` for authentication, injection, and transport security.

---

## Data Classification

Classify data before you store it. Classification drives every other decision: what to log, how long to keep it, who can access it, and how to protect it.

| Class | Definition | Examples |
|---|---|---|
| **Public** | Deliberately public, no protection needed | Product documentation, public pricing |
| **Internal** | Not public, low sensitivity | Aggregate analytics, non-PII logs |
| **Confidential** | Business-sensitive, controlled access | Financial data, internal communications |
| **PII** | Identifies or can identify a person | Name, email, phone, IP address, device ID |
| **Sensitive PII** | High-risk identification data | SSN, passport, biometrics, health data, exact location |
| **Payment** | Financial instrument data | Card numbers, bank account numbers (PCI DSS scope) |

**The rule:** data class determines access control, retention limit, encryption requirement, and whether it can appear in logs. Determine the class when the field is designed, not after.

---

## Data Minimization

### Collect only what you need for the stated purpose

Before adding a new field to a user record, ask: do you actually need this to deliver the product feature? If the answer isn't clearly yes, don't collect it. Data you don't have can't be breached, subpoenaed, or mis-handled.

Common over-collection patterns to avoid:
- Collecting date of birth when age verification only needs "over 18"
- Storing full IP addresses when geolocation at the country level is sufficient
- Logging full request bodies when only status codes are needed
- Storing credit card numbers when a payment token suffices

### Don't over-retain

Set a retention limit before you store any new data type. Data that serves no current purpose is pure liability.

| Data Type | Typical Retention | Notes |
|---|---|---|
| Active session tokens | Session lifetime | Delete on logout |
| Audit logs | 1–7 years | Required by many compliance frameworks |
| User PII | Duration of account + 30 days | Or as required by applicable law |
| Payment records | 7 years | Tax and legal requirements |
| Analytics events | 13 months | Rolling 12-month comparison period |
| Error logs | 90 days | Usually no PII, but set a limit anyway |
| Security logs | 1 year minimum | Needed for incident investigation |

### Implement retention enforcement, not just policy

Retention is meaningless without automated deletion. Write a scheduled job that deletes or anonymizes records past their retention date — and test that it runs.

```typescript
// Run daily — delete expired user data
async function enforceRetention() {
  const cutoff = subDays(new Date(), 30)

  // Anonymize users deleted more than 30 days ago
  await db.user.updateMany({
    where: { deletedAt: { lt: cutoff } },
    data: {
      email: `deleted_${userId}@example.com`,
      name: '[deleted]',
      phoneNumber: null,
      avatarUrl: null,
    },
  })
}
```

---

## User Rights (GDPR / CCPA)

If your application has users in the EU or California, these aren't optional. Build these capabilities into the product architecture, not as an afterthought.

### Right to Access (GDPR Article 15)

Users can request a copy of all data you hold about them.

- Build a data export endpoint that returns a machine-readable (JSON/CSV) file of all user data
- Include: profile data, activity history, preferences, any inferences made from their data
- Must be fulfillable within 30 days of request (GDPR) or 45 days (CCPA)
- Don't include other users' data even if they appear in the requesting user's records

### Right to Deletion (GDPR Article 17 — "Right to be Forgotten")

Users can request deletion of their data.

Design for deletion **before** you build the feature. When a user deletes their account:
- Delete or anonymize PII across all tables, services, and backups within 30 days
- Retain only what you have a legal obligation to keep (financial records, legal holds)
- Remove from third-party integrations (analytics, marketing tools, CRMs)
- Cancel any scheduled jobs that would use their data

**The expand-contract problem:** deletion is hard when data is denormalized or copied across systems. Keep PII in as few places as possible, and use user IDs as foreign keys rather than embedding name/email in every table.

### Right to Portability (GDPR Article 20)

Data must be exportable in a machine-readable format. JSON satisfies this; PDF does not.

### Right to Correction (GDPR Article 16)

Users can correct inaccurate data. Don't make PII fields immutable without a reason.

### How to operationalize user rights

Build a `/api/user/data-request` endpoint that:
1. Authenticates the request (it must be the user themselves)
2. Queues an async job (exports can be large)
3. Emails the user a download link when ready
4. Logs the request for compliance audit trail

---

## Anonymization vs. Pseudonymization

These terms have legal significance. Use the right one.

| Technique | Definition | Still PII? | Reversible? |
|---|---|---|---|
| **Anonymization** | All identifying data removed or replaced; individual cannot be re-identified | No | No |
| **Pseudonymization** | Identifier replaced with a token; original can be recovered with the key | Yes (key exists) | Yes |
| **Aggregation** | Individual data replaced with group statistics | No (if k≥3) | No |

**Pseudonymization is not anonymization.** If you replace email with a hash of the email, that's pseudonymization — the email can be recovered by hashing known email addresses. GDPR still applies to pseudonymous data.

For analytics and data science:
- Never run analytics on raw PII — pseudonymize first
- Aggregated reports with group sizes below k=3 can re-identify individuals — suppress them
- Share only aggregate data with third-party analytics tools, not individual event streams with PII

---

## Consent Management

### Record consent before processing

For any data processing beyond what's strictly necessary to deliver the service the user signed up for, you need explicit consent.

```typescript
// Consent record — immutable log, not just a boolean
interface ConsentRecord {
  userId: string
  purpose: 'marketing' | 'analytics' | 'thirdPartySharing'
  given: boolean
  givenAt: Date
  ipAddress: string        // proof of consent circumstances
  consentVersion: string   // which version of the consent text they saw
  source: 'signup' | 'settings' | 'popup'
}
```

**Never pre-check consent boxes.** Consent must be actively given, not defaulted.

### Consent withdrawal

If a user withdraws consent, stop processing their data for that purpose immediately. Keep the consent record (you need it to prove they consented before withdrawal) but respect the withdrawal going forward.

### Marketing communications

- Provide an unsubscribe link in every email — this is legally required in most jurisdictions
- Honor unsubscribe requests within 10 business days (legally required in the US, immediately in EU)
- Maintain a suppression list — don't re-add unsubscribed users when you import a new list

---

## Third-Party Data Sharing

### Data sharing requires a legal basis

Before sending user data to a third-party service (analytics, CRM, support tools, ad platforms):
1. Do you have user consent, or a legitimate interest that survives a balancing test?
2. Does the third party have a Data Processing Agreement (DPA)?
3. Is the transfer lawful under applicable law (adequacy decision, Standard Contractual Clauses for EU→US)?

### Minimize what you send

Don't send full user profiles to third-party tools. Send only what that tool needs:

```typescript
// Bad — sending full user object to analytics
analytics.track('purchase', { user, order })

// Good — send only the fields analytics actually needs
analytics.track('purchase', {
  userId: user.id,     // pseudonymous ID, not email
  plan: user.plan,
  orderValue: order.total,
  currency: order.currency,
})
```

### Audit third-party data access

Maintain a data processing register: for every third-party tool, document what data you send, why, and what DPA covers it. This is a GDPR Article 30 requirement.

---

## Encryption at Rest

### What must be encrypted

| Data | Requirement |
|---|---|
| Passwords | Hashed (bcrypt/argon2) — not encrypted, not reversible |
| Payment data | PCI DSS requires encryption in storage; prefer tokenization |
| Sensitive PII (SSN, biometrics) | Encrypted with application-level key, separate from DB credentials |
| Backup files | Encrypted before writing to object storage |

### What database-level encryption covers (and doesn't)

Database-level encryption (Transparent Data Encryption, AWS RDS encryption) protects against someone stealing the physical disk. It does not protect against:
- SQL injection that reads the plaintext data from a running database
- Compromised application credentials that connect to the database

For sensitive fields, use application-level encryption with a separate key management system (AWS KMS, HashiCorp Vault) so that database access alone is insufficient to read the data.

---

## PII in Logs, Errors, and Analytics

### The rule: no PII in logs

```typescript
// Bad
logger.info('user.login', { email, userId, ip })

// Good — log the ID, not the identifying value
logger.info('user.login', { userId, ip: hashIp(ip) })
```

IP addresses are PII in most EU jurisdictions. Hash or truncate them before logging. Email addresses should never appear in log lines.

### Error messages to users

Never expose:
- Database error details (table names, column names, constraint names)
- Stack traces
- Internal file paths
- Environment variable names

These tell an attacker about your system structure. Return a generic error with a correlation ID; let engineers look up the real error in internal logs.

### Analytics

Don't include user-identifying information in analytics events. Use a pseudonymous user ID that you control — if a user requests deletion, you can revoke the mapping and their historical analytics become anonymous.

---

## Privacy by Design Checklist

For every new feature that handles user data:

- [ ] What PII does this feature collect? Is it the minimum necessary?
- [ ] What is the retention limit for this data?
- [ ] Is deletion handled if the user deletes their account?
- [ ] Does this data flow to any third-party services?
- [ ] Is consent required before collecting it?
- [ ] Is sensitive data encrypted at rest with a separate key?
- [ ] Does this data appear in logs? Is it being redacted?
- [ ] Can a user export or correct this data?
