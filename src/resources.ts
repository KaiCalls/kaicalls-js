import { HttpClient, KaiCallsError } from './client.js';
import type {
  Agent,
  Call,
  EvalRun,
  EvalScenario,
  Lead,
  PhoneNumber,
  SignupResult,
  Transcript,
  WebhookSubscription,
  Workspace,
} from './types.js';

/** Remove undefined values so we never send `"key": undefined`. */
function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const ACTIVE_CALL_STATUSES = new Set([
  'queued',
  'ringing',
  'in-progress',
  'in_progress',
  'started',
]);

export class CallsResource {
  constructor(private readonly http: HttpClient) {}

  /** Start an outbound call. Requires calls:write. */
  create(params: {
    agentId: string;
    to: string;
    name?: string;
    context?: string;
    firstMessage?: string;
    leadId?: string;
    webhookUrl?: string;
    maxDuration?: number;
  }): Promise<Call> {
    return this.http.request<Call>('/api/v1/calls', {
      method: 'POST',
      body: compact({
        agent_id: params.agentId,
        to: params.to,
        name: params.name,
        context: params.context,
        first_message: params.firstMessage,
        lead_id: params.leadId,
        webhook_url: params.webhookUrl,
        max_duration: params.maxDuration,
      }),
    });
  }

  /** Fetch one call (summary, recording_url, quality_dimensions). Requires calls:read. */
  get(id: string): Promise<Call> {
    return this.http.request<Call>('/api/v1/calls', { query: { id } });
  }

  /** List calls, newest first. Requires calls:read. */
  list(
    params: { limit?: number; agentId?: string; status?: string; after?: string } = {},
  ): Promise<{
    calls: Call[];
    has_more?: boolean;
  }> {
    return this.http.request('/api/v1/calls', {
      query: {
        limit: params.limit,
        agent_id: params.agentId,
        status: params.status,
        after: params.after,
      },
    });
  }

  /**
   * Poll a call until it leaves an active status (queued/ringing/in-progress)
   * or `timeoutMs` elapses. Returns the final call record.
   */
  async wait(id: string, options: { intervalMs?: number; timeoutMs?: number } = {}): Promise<Call> {
    const intervalMs = options.intervalMs ?? 3_000;
    const timeoutMs = options.timeoutMs ?? 10 * 60_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const call = await this.get(id);
      if (!ACTIVE_CALL_STATUSES.has(String(call.status))) return call;
      if (Date.now() >= deadline) {
        throw new KaiCallsError(
          0,
          'wait_timeout',
          `Call ${id} still "${call.status}" after ${timeoutMs}ms`,
          call,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

export class RecordingsResource {
  constructor(private readonly http: HttpClient) {}

  /** Signed recording URL + status for one call. Requires calls:read. */
  get(callId: string): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/recordings', { query: { call_id: callId } });
  }
}

export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  /** List agents across accessible businesses. Requires agents:read. */
  list(): Promise<{ agents: Agent[] }> {
    return this.http.request('/api/v1/agents');
  }

  /** Fetch one agent with prompts, voice, model, and phone number. Requires agents:read. */
  get(id: string): Promise<Agent> {
    return this.http.request('/api/v1/agents', { query: { id } });
  }

  /** Create a voice agent. Requires agents:write. */
  create(params: {
    businessId: string;
    name: string;
    systemPrompt: string;
    firstMessage?: string;
    voice?: Record<string, unknown>;
    model?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<Agent> {
    return this.http.request('/api/v1/agents', {
      method: 'POST',
      body: compact({
        business_id: params.businessId,
        name: params.name,
        system_prompt: params.systemPrompt,
        first_message: params.firstMessage,
        voice: params.voice,
        model: params.model,
        metadata: params.metadata,
      }),
    });
  }

  /** Partial update — send only the fields to change. Requires agents:write. */
  update(params: {
    id: string;
    name?: string;
    inboundPrompt?: string;
    outboundPrompt?: string;
    smsPrompt?: string;
    firstMessage?: string;
    outboundFirstMessage?: string;
    outboundLlm?: string;
    smsLlm?: string;
    voice?: Record<string, unknown>;
    model?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    maxDuration?: number;
    vapiConfig?: Record<string, unknown>;
    transferEnabled?: boolean;
    transferPhoneNumber?: string;
  }): Promise<Agent> {
    return this.http.request('/api/v1/agents', {
      method: 'PATCH',
      body: compact({
        id: params.id,
        name: params.name,
        inbound_prompt: params.inboundPrompt,
        outbound_prompt: params.outboundPrompt,
        sms_prompt: params.smsPrompt,
        first_message: params.firstMessage,
        outbound_first_message: params.outboundFirstMessage,
        outbound_llm: params.outboundLlm,
        sms_llm: params.smsLlm,
        voice: params.voice,
        model: params.model,
        metadata: params.metadata,
        max_duration: params.maxDuration,
        vapi_config: params.vapiConfig,
        transfer_enabled: params.transferEnabled,
        transfer_phone_number: params.transferPhoneNumber,
      }),
    });
  }

  /** Hashed config version history with rollback lineage. Requires agents:read. */
  versions(params: {
    agentId: string;
    version?: number;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/agents/versions', {
      query: { agent_id: params.agentId, version: params.version, limit: params.limit },
    });
  }
}

export class LeadsResource {
  constructor(private readonly http: HttpClient) {}

  /** List leads with filters. Requires leads:read. */
  list(
    params: {
      status?: string | string[];
      source?: string;
      agentId?: string;
      phone?: string;
      email?: string;
      createdAfter?: string;
      createdBefore?: string;
      updatedAfter?: string;
      updatedBefore?: string;
      scoreGte?: number;
      scoreLte?: number;
      limit?: number;
    } = {},
  ): Promise<{ leads: Lead[]; has_more?: boolean }> {
    return this.http.request('/api/v1/leads', {
      query: {
        status: Array.isArray(params.status) ? params.status.join(',') : params.status,
        source: params.source,
        agent_id: params.agentId,
        phone: params.phone,
        email: params.email,
        created_after: params.createdAfter,
        created_before: params.createdBefore,
        updated_after: params.updatedAfter,
        updated_before: params.updatedBefore,
        score_gte: params.scoreGte,
        score_lte: params.scoreLte,
        limit: params.limit,
      },
    });
  }

  /** Fetch one lead. Requires leads:read. */
  get(id: string): Promise<Lead> {
    return this.http.request('/api/v1/leads', { query: { id } });
  }

  /** Create a lead. Requires leads:write. */
  create(params: {
    businessId: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    status?: string;
    source?: string;
    sourceUrl?: string;
    sourcePage?: string;
    notes?: string;
    message?: string;
    eventDate?: string;
    eventType?: string;
    agentId?: string;
    timezone?: string;
  }): Promise<Lead> {
    return this.http.request('/api/v1/leads', {
      method: 'POST',
      body: compact({
        business_id: params.businessId,
        name: params.name,
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        phone: params.phone,
        address: params.address,
        city: params.city,
        state: params.state,
        zip: params.zip,
        status: params.status,
        source: params.source,
        source_url: params.sourceUrl,
        source_page: params.sourcePage,
        notes: params.notes,
        message: params.message,
        event_date: params.eventDate,
        event_type: params.eventType,
        agent_id: params.agentId,
        timezone: params.timezone,
      }),
    });
  }

  /** Update a lead — send only the fields to change. Requires leads:write. */
  update(params: { id: string } & Record<string, unknown>): Promise<Lead> {
    return this.http.request('/api/v1/leads', { method: 'PATCH', body: compact(params) });
  }

  /** Pipeline health snapshot (hot/stalled leads, signups, voicemails). Requires leads:read. */
  audit(
    params: { windowHours?: number; stalledDays?: number; hotScore?: number; asOf?: string } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/leads/audit', {
      query: {
        window_hours: params.windowHours,
        stalled_days: params.stalledDays,
        hot_score: params.hotScore,
        as_of: params.asOf,
      },
    });
  }
}

export class SmsResource {
  constructor(private readonly http: HttpClient) {}

  /** Send an SMS from an agent's number (DNC/consent checks apply). Requires sms:write. */
  send(params: {
    to: string;
    fromAgentId: string;
    message: string;
    leadId?: string;
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/sms/send', {
      method: 'POST',
      body: compact({
        to: params.to,
        from_agent_id: params.fromAgentId,
        message: params.message,
        lead_id: params.leadId,
      }),
    });
  }

  /** Update an agent's SMS auto-reply prompt. Requires agents:write. */
  updatePrompt(params: {
    agentId: string;
    smsPrompt: string;
    reason?: string;
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/sms/update-prompt', {
      method: 'POST',
      body: compact({
        agent_id: params.agentId,
        sms_prompt: params.smsPrompt,
        reason: params.reason,
      }),
    });
  }

  /** List SMS threads. Requires sms:read. */
  conversations(params: { id?: string; limit?: number } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/sms/conversations', {
      query: { id: params.id, limit: params.limit },
    });
  }

  /** List SMS messages. Requires sms:read. */
  messages(
    params: {
      conversationId?: string;
      direction?: 'inbound' | 'outbound';
      after?: string;
      limit?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/sms/messages', {
      query: {
        conversation_id: params.conversationId,
        direction: params.direction,
        after: params.after,
        limit: params.limit,
      },
    });
  }
}

export class TranscriptsResource {
  constructor(private readonly http: HttpClient) {}

  /** Recent transcripts with summaries. Requires calls:read. */
  list(
    params: { limit?: number; agentId?: string; after?: string; days?: number } = {},
  ): Promise<{ transcripts: Transcript[]; has_more?: boolean }> {
    return this.http.request('/api/v1/transcripts', {
      query: {
        limit: params.limit,
        agent_id: params.agentId,
        after: params.after,
        days: params.days,
      },
    });
  }
}

export class PhoneNumbersResource {
  constructor(private readonly http: HttpClient) {}

  /** List numbers with capabilities and compliance state. Requires numbers:read. */
  list(params: { businessId?: string; phoneNumber?: string } = {}): Promise<{
    numbers?: PhoneNumber[];
    number?: PhoneNumber | null;
    [key: string]: unknown;
  }> {
    return this.http.request('/api/v1/phone-numbers', {
      query: { business_id: params.businessId, phone_number: params.phoneNumber },
    });
  }

  /** Unassigned pool inventory. Requires numbers:read. */
  available(
    params: { country?: string; areaCode?: string; capability?: string; limit?: number } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/phone-numbers/available', {
      query: {
        country: params.country,
        area_code: params.areaCode,
        capability: params.capability,
        limit: params.limit,
      },
    });
  }

  /** Assign a registry number to a business/agent. Requires numbers:write. */
  assign(params: {
    phoneNumber: string;
    businessId?: string;
    agentId?: string;
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/phone-numbers', {
      method: 'POST',
      body: compact({
        phone_number: params.phoneNumber,
        business_id: params.businessId,
        agent_id: params.agentId,
      }),
    });
  }

  /** Release a number. Requires numbers:write. */
  release(params: { phoneNumber: string; businessId?: string }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/phone-numbers', {
      method: 'DELETE',
      query: { phone_number: params.phoneNumber, business_id: params.businessId },
    });
  }
}

export class WorkspacesResource {
  constructor(private readonly http: HttpClient) {}

  /** List accessible workspaces. Requires workspaces:read. */
  list(): Promise<{ workspaces: Workspace[] }> {
    return this.http.request('/api/v1/workspaces');
  }

  /** Fetch one workspace. Requires workspaces:read. */
  get(id: string): Promise<Workspace> {
    return this.http.request('/api/v1/workspaces', { query: { id } });
  }

  /** Create a workspace. Requires workspaces:write. */
  create(params: {
    name: string;
    metadata?: Record<string, unknown>;
    externalRef?: string;
  }): Promise<Workspace> {
    return this.http.request('/api/v1/workspaces', {
      method: 'POST',
      body: compact({
        name: params.name,
        metadata: params.metadata,
        external_ref: params.externalRef,
      }),
    });
  }

  /**
   * Rename, update metadata, or run a lifecycle action
   * (pause/resume/cancel/teardown — actions require lifecycle:write).
   */
  update(params: {
    id: string;
    name?: string;
    metadata?: Record<string, unknown>;
    action?: 'pause' | 'resume' | 'cancel' | 'teardown';
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/workspaces', { method: 'PATCH', body: compact(params) });
  }
}

export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  /** List webhook subscriptions (masked secrets). Requires webhooks:read. */
  list(params: { businessId?: string } = {}): Promise<{
    webhooks?: WebhookSubscription[];
    events?: string[];
    [key: string]: unknown;
  }> {
    return this.http.request('/api/v1/webhooks', { query: { business_id: params.businessId } });
  }

  /**
   * Create (or upsert with `id`) a webhook subscription. The signing secret
   * is returned ONCE as `webhook_secret` — store it immediately.
   * Requires webhooks:write.
   */
  create(params: {
    webhookUrl: string;
    businessId?: string;
    events?: string[];
    description?: string;
    id?: string;
    isActive?: boolean;
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/webhooks', {
      method: 'POST',
      body: compact({
        webhook_url: params.webhookUrl,
        business_id: params.businessId,
        events: params.events,
        description: params.description,
        id: params.id,
        is_active: params.isActive,
      }),
    });
  }

  /** Remove a webhook subscription. Requires webhooks:write. */
  delete(params: { id: string; businessId?: string }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/webhooks', {
      method: 'DELETE',
      query: { id: params.id, business_id: params.businessId },
    });
  }

  /** Send a signed synthetic webhook.test event. Requires webhooks:write. */
  test(params: {
    id: string;
    businessId?: string;
    data?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/webhooks/test', {
      method: 'POST',
      body: compact({ id: params.id, business_id: params.businessId, data: params.data }),
    });
  }

  /** Rotate a signing secret — the new secret is returned once. Requires webhooks:write. */
  rotateSecret(params: { id: string; businessId?: string }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/webhooks/rotate-secret', {
      method: 'POST',
      body: compact({ id: params.id, business_id: params.businessId }),
    });
  }
}

export class AnalyticsResource {
  constructor(private readonly http: HttpClient) {}

  dashboard(params: { days?: number } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/analytics/dashboard', { query: { days: params.days } });
  }

  calls(
    params: { days?: number; groupBy?: 'day' | 'week'; agentId?: string } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/analytics/calls', {
      query: { days: params.days, group_by: params.groupBy, agent_id: params.agentId },
    });
  }

  funnel(params: { days?: number; source?: string } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/analytics/funnel', {
      query: { days: params.days, source: params.source },
    });
  }

  agents(params: { days?: number; agentId?: string } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/analytics/agents', {
      query: { days: params.days, agent_id: params.agentId },
    });
  }

  weekly(): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/analytics/weekly');
  }

  businesses(params: { days?: number } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/analytics/businesses', { query: { days: params.days } });
  }
}

export class EvalsResource {
  constructor(private readonly http: HttpClient) {}

  /** Create an eval scenario (mirrored to Vapi). Requires evals:write. */
  create(params: {
    agentId: string;
    businessId: string;
    name: string;
    description?: string;
    messages: unknown[];
  }): Promise<EvalScenario> {
    return this.http.request('/api/v1/evals', {
      method: 'POST',
      body: compact({
        agent_id: params.agentId,
        business_id: params.businessId,
        name: params.name,
        description: params.description,
        messages: params.messages,
      }),
    });
  }

  /** List evals (optionally for one agent). Requires evals:read. */
  list(params: { agentId?: string } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/evals', { query: { agent_id: params.agentId } });
  }

  /** Fetch one eval with full messages. Requires evals:read. */
  get(id: string): Promise<EvalScenario> {
    return this.http.request('/api/v1/evals', { query: { id } });
  }

  /** Update an eval. Requires evals:write. */
  update(params: {
    id: string;
    name?: string;
    description?: string;
    messages?: unknown[];
  }): Promise<EvalScenario> {
    return this.http.request('/api/v1/evals', { method: 'PATCH', body: compact(params) });
  }

  /** Delete an eval (local + Vapi mirror). Requires evals:write. */
  delete(id: string): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/evals', { method: 'DELETE', query: { id } });
  }

  /** Run one eval (`evalId`) or fan out all of an agent's evals (`agentId`). Requires evals:write. */
  run(params: {
    evalId?: string;
    agentId?: string;
    wait?: boolean;
    maxWaitMs?: number;
  }): Promise<EvalRun | Record<string, unknown>> {
    return this.http.request('/api/v1/evals/run', {
      method: 'POST',
      body: compact({
        eval_id: params.evalId,
        agent_id: params.agentId,
        wait: params.wait,
        max_wait_ms: params.maxWaitMs,
      }),
    });
  }

  /** Poll a run by runId/vapiRunId, or list recent runs for an agent. Requires evals:read. */
  getRun(params: {
    runId?: string;
    vapiRunId?: string;
    agentId?: string;
  }): Promise<EvalRun | Record<string, unknown>> {
    return this.http.request('/api/v1/evals/run', {
      query: { run_id: params.runId, vapi_run_id: params.vapiRunId, agent_id: params.agentId },
    });
  }
}

export class EventsResource {
  constructor(private readonly http: HttpClient) {}

  /** Durable events with delivery state. Requires events:read. */
  list(
    params: {
      businessId?: string;
      eventId?: string;
      eventType?: string;
      objectType?: string;
      objectId?: string;
      status?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/events', {
      query: {
        business_id: params.businessId,
        event_id: params.eventId,
        event_type: params.eventType,
        object_type: params.objectType,
        object_id: params.objectId,
        status: params.status,
        from: params.from,
        to: params.to,
        limit: params.limit,
      },
    });
  }

  /** Webhook delivery attempts. Requires events:read or webhooks:read. */
  deliveries(
    params: {
      businessId?: string;
      eventId?: string;
      webhookId?: string;
      status?: 'succeeded' | 'failed';
      limit?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/event-deliveries', {
      query: {
        business_id: params.businessId,
        event_id: params.eventId,
        webhook_id: params.webhookId,
        status: params.status,
        limit: params.limit,
      },
    });
  }

  /** Re-queue specific events for redelivery. Requires events:replay. */
  replay(params: {
    businessId?: string;
    eventId?: string;
    eventIds?: string[];
    filter?: { event_type?: string; object_id?: string; status?: string };
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/events/replay', {
      method: 'POST',
      body: compact({
        business_id: params.businessId,
        event_id: params.eventId,
        event_ids: params.eventIds,
        filter: params.filter,
      }),
    });
  }

  /** Re-queue a bounded time window of events. Requires events:replay. */
  backfill(params: {
    from: string;
    to: string;
    businessId?: string;
    eventType?: string;
    status?: string;
  }): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/events/backfill', {
      method: 'POST',
      body: compact({
        from: params.from,
        to: params.to,
        business_id: params.businessId,
        event_type: params.eventType,
        status: params.status,
      }),
    });
  }
}

export class CommunicationRunsResource {
  constructor(private readonly http: HttpClient) {}

  /** Validate a run payload without scheduling anything. Requires communication-runs:write. */
  validate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-runs/validate', { method: 'POST', body });
  }

  /** Preview planned touches, counts, and timing. Requires communication-runs:write. */
  preview(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-runs/preview', { method: 'POST', body });
  }

  /** Create a run. Idempotency key required; replays return the original result. */
  create(
    body: Record<string, unknown>,
    options: { idempotencyKey: string },
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-runs', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': options.idempotencyKey },
    });
  }

  /** List runs, or fetch one by id/externalRef (includes touches). */
  list(
    params: { businessId?: string; id?: string; externalRef?: string; limit?: number } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-runs', {
      query: {
        business_id: params.businessId,
        id: params.id,
        external_ref: params.externalRef,
        limit: params.limit,
      },
    });
  }

  /** Pause a run. */
  pause(id: string, params: { businessId?: string } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-runs', {
      method: 'PATCH',
      body: compact({ id, action: 'pause', business_id: params.businessId }),
    });
  }

  /** Cancel a run. */
  cancel(id: string, params: { businessId?: string } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-runs', {
      method: 'PATCH',
      body: compact({ id, action: 'cancel', business_id: params.businessId }),
    });
  }

  /** Per-touch job status. Requires communication-runs:read. */
  jobs(
    params: {
      communicationRunId?: string;
      channel?: 'call' | 'sms';
      status?: string;
      limit?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-jobs', {
      query: {
        communication_run_id: params.communicationRunId,
        channel: params.channel,
        status: params.status,
        limit: params.limit,
      },
    });
  }

  /** Outbound call attempts with retry eligibility. */
  attempts(
    params: { sequenceId?: string; status?: string; limit?: number } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/communication-attempts', {
      query: { sequence_id: params.sequenceId, status: params.status, limit: params.limit },
    });
  }
}

export class DiscoveryResource {
  constructor(private readonly http: HttpClient) {}

  /** Workspaces + endpoints/scopes available to this key. */
  capabilities(params: { businessId?: string } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/capabilities', {
      query: { business_id: params.businessId },
    });
  }

  /** Canonical OpenAPI 3 document for the public API. */
  openapi(): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/openapi.json');
  }

  /** JSON Schemas for request/response objects. */
  schemas(params: { name?: string } = {}): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/schemas', { query: { name: params.name } });
  }

  /** API/queue/provider status for the authenticated account. */
  health(): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/health');
  }
}

export class AccountResource {
  constructor(private readonly http: HttpClient) {}

  /** Usage and subscription status per business. */
  balance(): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/balance');
  }

  /** API usage log. */
  usage(
    params: { start?: string; end?: string; limit?: number } = {},
  ): Promise<Record<string, unknown>> {
    return this.http.request('/api/v1/usage', {
      query: { start: params.start, end: params.end, limit: params.limit },
    });
  }
}

/**
 * Create a brand-new KaiCalls account (no API key required; 5/hour/IP).
 * Returns the new account's API key — store it securely.
 */
export async function signup(
  params: {
    businessName: string;
    email: string;
    businessType?: string;
    website?: string;
    phoneForwardTo?: string;
    planId?: string;
  },
  options: { baseUrl?: string; fetch?: typeof fetch } = {},
): Promise<SignupResult> {
  const baseUrl = (options.baseUrl ?? 'https://www.kaicalls.com').replace(/\/+$/, '');
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`${baseUrl}/api/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      compact({
        business_name: params.businessName,
        email: params.email,
        business_type: params.businessType,
        website: params.website,
        phone_forward_to: params.phoneForwardTo,
        plan_id: params.planId,
      }),
    ),
  });
  const data = (await response.json()) as SignupResult & {
    error?: { code: string; message: string };
  };
  if (!response.ok) {
    throw new KaiCallsError(
      response.status,
      data?.error?.code ?? `http_${response.status}`,
      data?.error?.message ?? `Signup failed (HTTP ${response.status})`,
      data,
    );
  }
  return data;
}
