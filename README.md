# kaicalls

Official JavaScript/TypeScript SDK for the [KaiCalls](https://www.kaicalls.com) API — give your AI agent a phone. Outbound calls, agents, leads, SMS, transcripts, webhooks, and platform APIs.

- Zero dependencies (uses native `fetch`, Node 18+)
- Full TypeScript types, ESM + CJS
- Docs: <https://www.kaicalls.com/docs/api> · Live OpenAPI: `GET /api/v1/openapi.json`

## Install

```bash
npm install kaicalls
```

## Quick start

```ts
import { KaiCalls } from 'kaicalls';

const kai = new KaiCalls({ apiKey: 'kc_live_...' });

// Make an outbound call — the agent auto-enriches with CRM context
const call = await kai.calls.create({
  agentId: 'uuid-abc123',
  to: '+15125551234',
  name: 'John Smith',
  context: 'Following up on his kitchen remodel inquiry',
});

// Block until the call finishes, then read the AI summary
const result = await kai.calls.wait(call.id);
console.log(result.summary);
```

## No account yet? Sign up via the API

```ts
import { KaiCalls } from 'kaicalls';

const account = await KaiCalls.signup({
  businessName: 'Smith Law Firm',
  email: 'contact@smithlaw.com',
  planId: 'starter',
});
// account.api_key works immediately; send the owner to account.checkout_url
const kai = new KaiCalls({ apiKey: account.api_key });
```

## What's wrapped

| Resource | Methods |
|----------|---------|
| `kai.calls` | `create`, `get`, `list`, `wait` |
| `kai.recordings` | `get` |
| `kai.agents` | `list`, `get`, `create`, `update`, `versions` |
| `kai.leads` | `list`, `get`, `create`, `update`, `audit` |
| `kai.sms` | `send`, `updatePrompt`, `conversations`, `messages` |
| `kai.transcripts` | `list` |
| `kai.phoneNumbers` | `list`, `available`, `assign`, `release` |
| `kai.workspaces` | `list`, `get`, `create`, `update` (lifecycle actions) |
| `kai.webhooks` | `list`, `create`, `delete`, `test`, `rotateSecret` |
| `kai.analytics` | `dashboard`, `calls`, `funnel`, `agents`, `weekly`, `businesses` |
| `kai.evals` | `create`, `list`, `get`, `update`, `delete`, `run`, `getRun` |
| `kai.events` | `list`, `deliveries`, `replay`, `backfill` |
| `kai.communicationRuns` | `validate`, `preview`, `create`, `list`, `pause`, `cancel`, `jobs`, `attempts` |
| `kai.discovery` | `capabilities`, `openapi`, `schemas`, `health` |
| `kai.account` | `balance`, `usage` |

Anything not wrapped yet is reachable through the escape hatch:

```ts
await kai.request('/api/sdr/pipeline', { query: { businessId: 'uuid-biz' } });
```

## Errors

All non-2xx responses throw `KaiCallsError` with `status`, `code` (e.g. `unauthorized`, `forbidden`, `rate_limited`), `message`, and the raw `body`.

```ts
import { KaiCallsError } from 'kaicalls';

try {
  await kai.calls.create({ agentId, to });
} catch (err) {
  if (err instanceof KaiCallsError && err.code === 'rate_limited') {
    // back off and retry
  }
}
```

## Notes

- Get an API key at <https://www.kaicalls.com/dashboard/settings/api>. New keys default to read-only scopes — request write scopes (`calls:write`, `sms:write`, …) when creating the key.
- Phone numbers are E.164 (`+15125551234`).
- API reference: <https://www.kaicalls.com/docs/api> · Errors: <https://www.kaicalls.com/docs/api/errors>
