import test from 'node:test';
import assert from 'node:assert/strict';
import { KaiCalls, KaiCallsError } from '../dist/index.js';

function mockFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const result = handler(url, init);
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  impl.calls = calls;
  return impl;
}

test('requires an api key', () => {
  assert.throws(() => new KaiCalls({ apiKey: '' }), /apiKey is required/);
});

test('calls.create maps camelCase params to snake_case and posts', async () => {
  const fetchImpl = mockFetch(() => ({
    status: 201,
    body: { id: 'call-1', status: 'queued' },
  }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });

  const call = await kai.calls.create({
    agentId: 'agent-1',
    to: '+15125551234',
    name: 'John',
    firstMessage: 'Hey John',
    leadId: 'lead-1',
    maxDuration: 300,
  });

  assert.equal(call.id, 'call-1');
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url, 'https://www.kaicalls.com/api/v1/calls');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer kc_live_test');
  const body = JSON.parse(init.body);
  assert.deepEqual(body, {
    agent_id: 'agent-1',
    to: '+15125551234',
    name: 'John',
    first_message: 'Hey John',
    lead_id: 'lead-1',
    max_duration: 300,
  });
});

test('calls.get uses ?id= query (no dynamic path segments)', async () => {
  const fetchImpl = mockFetch(() => ({ body: { id: 'call-1', status: 'ended' } }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  await kai.calls.get('call-1');
  assert.equal(fetchImpl.calls[0].url, 'https://www.kaicalls.com/api/v1/calls?id=call-1');
});

test('calls.wait polls until a terminal status', async () => {
  let n = 0;
  const fetchImpl = mockFetch(() => {
    n += 1;
    return { body: { id: 'call-1', status: n < 3 ? 'in-progress' : 'ended', summary: 'done' } };
  });
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  const result = await kai.calls.wait('call-1', { intervalMs: 1 });
  assert.equal(result.status, 'ended');
  assert.equal(result.summary, 'done');
  assert.equal(n, 3);
});

test('agents.update sends only provided fields', async () => {
  const fetchImpl = mockFetch(() => ({ body: { id: 'agent-1', updated: true } }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  await kai.agents.update({
    id: 'agent-1',
    inboundPrompt: 'New prompt',
    vapiConfig: { endCallPhrases: ['goodbye'] },
  });
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.deepEqual(body, {
    id: 'agent-1',
    inbound_prompt: 'New prompt',
    vapi_config: { endCallPhrases: ['goodbye'] },
  });
  assert.equal(fetchImpl.calls[0].init.method, 'PATCH');
});

test('leads.list joins multiple statuses with commas', async () => {
  const fetchImpl = mockFetch(() => ({ body: { leads: [], has_more: false } }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  await kai.leads.list({ status: ['new', 'contacted'], limit: 10 });
  const url = new URL(fetchImpl.calls[0].url);
  assert.equal(url.searchParams.get('status'), 'new,contacted');
  assert.equal(url.searchParams.get('limit'), '10');
});

test('sms.send posts the documented shape', async () => {
  const fetchImpl = mockFetch(() => ({ body: { success: true, message_sid: 'SM1' } }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  const res = await kai.sms.send({
    to: '+15125551234',
    fromAgentId: 'agent-1',
    message: 'Hi!',
  });
  assert.equal(res.success, true);
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.deepEqual(body, { to: '+15125551234', from_agent_id: 'agent-1', message: 'Hi!' });
});

test('communicationRuns.create sends the Idempotency-Key header', async () => {
  const fetchImpl = mockFetch(() => ({ status: 201, body: { success: true } }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  await kai.communicationRuns.create({ business_id: 'biz-1' }, { idempotencyKey: 'idem-1' });
  assert.equal(fetchImpl.calls[0].init.headers['Idempotency-Key'], 'idem-1');
});

test('API errors raise KaiCallsError with code and status', async () => {
  const fetchImpl = mockFetch(() => ({
    status: 403,
    body: { error: { code: 'forbidden', message: 'Missing required scope' } },
  }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  await assert.rejects(
    () => kai.calls.create({ agentId: 'a', to: '+1' }),
    (err) => {
      assert.ok(err instanceof KaiCallsError);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'forbidden');
      assert.match(err.message, /Missing required scope/);
      return true;
    },
  );
});

test('signup works without an api key', async () => {
  const fetchImpl = mockFetch(() => ({
    status: 201,
    body: { api_key: 'kc_live_new', business_id: 'biz-1', agent_id: null, phone_number: null },
  }));
  const result = await KaiCalls.signup(
    { businessName: 'Smith Law', email: 'a@b.com', planId: 'starter' },
    { fetch: fetchImpl },
  );
  assert.equal(result.api_key, 'kc_live_new');
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.deepEqual(body, { business_name: 'Smith Law', email: 'a@b.com', plan_id: 'starter' });
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, undefined);
});

test('raw request escape hatch hits arbitrary paths', async () => {
  const fetchImpl = mockFetch(() => ({ body: { ok: true } }));
  const kai = new KaiCalls({ apiKey: 'kc_live_test', fetch: fetchImpl });
  await kai.request('/api/sdr/pipeline', { query: { businessId: 'biz-1' } });
  assert.equal(
    fetchImpl.calls[0].url,
    'https://www.kaicalls.com/api/sdr/pipeline?businessId=biz-1',
  );
});
