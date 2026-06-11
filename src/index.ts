import { HttpClient, type KaiCallsOptions, type RequestOptions } from './client.js';
import {
  AccountResource,
  AgentsResource,
  AnalyticsResource,
  CallsResource,
  CommunicationRunsResource,
  DiscoveryResource,
  EvalsResource,
  EventsResource,
  LeadsResource,
  PhoneNumbersResource,
  RecordingsResource,
  SmsResource,
  TranscriptsResource,
  WebhooksResource,
  WorkspacesResource,
  signup,
} from './resources.js';

export { KaiCallsError } from './client.js';
export type { KaiCallsOptions } from './client.js';
export * from './types.js';
export { signup };

/**
 * KaiCalls API client.
 *
 * ```ts
 * import { KaiCalls } from 'kaicalls';
 *
 * const kai = new KaiCalls({ apiKey: 'kc_live_...' });
 * const call = await kai.calls.create({
 *   agentId: 'uuid-abc123',
 *   to: '+15125551234',
 *   name: 'John Smith',
 * });
 * const result = await kai.calls.wait(call.id);
 * console.log(result.summary);
 * ```
 */
export class KaiCalls {
  private readonly http: HttpClient;

  readonly calls: CallsResource;
  readonly recordings: RecordingsResource;
  readonly agents: AgentsResource;
  readonly leads: LeadsResource;
  readonly sms: SmsResource;
  readonly transcripts: TranscriptsResource;
  readonly phoneNumbers: PhoneNumbersResource;
  readonly workspaces: WorkspacesResource;
  readonly webhooks: WebhooksResource;
  readonly analytics: AnalyticsResource;
  readonly evals: EvalsResource;
  readonly events: EventsResource;
  readonly communicationRuns: CommunicationRunsResource;
  readonly discovery: DiscoveryResource;
  readonly account: AccountResource;

  /** Create a brand-new KaiCalls account. No API key required. */
  static signup = signup;

  constructor(options: KaiCallsOptions) {
    this.http = new HttpClient(options);
    this.calls = new CallsResource(this.http);
    this.recordings = new RecordingsResource(this.http);
    this.agents = new AgentsResource(this.http);
    this.leads = new LeadsResource(this.http);
    this.sms = new SmsResource(this.http);
    this.transcripts = new TranscriptsResource(this.http);
    this.phoneNumbers = new PhoneNumbersResource(this.http);
    this.workspaces = new WorkspacesResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.analytics = new AnalyticsResource(this.http);
    this.evals = new EvalsResource(this.http);
    this.events = new EventsResource(this.http);
    this.communicationRuns = new CommunicationRunsResource(this.http);
    this.discovery = new DiscoveryResource(this.http);
    this.account = new AccountResource(this.http);
  }

  /**
   * Raw escape hatch for endpoints not yet wrapped:
   * `kai.request('/api/sdr/pipeline', { query: { businessId } })`
   */
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.http.request<T>(path, options);
  }
}

export default KaiCalls;
