// Response/object types are intentionally permissive: every object carries
// its documented fields plus an index signature so new server fields never
// break consumers.

export interface Call {
  id: string;
  conversation_id?: string | null;
  status: string;
  direction?: 'inbound' | 'outbound';
  duration?: number | null;
  agent_id?: string | null;
  agent_name?: string | null;
  business_id?: string | null;
  lead_id?: string | null;
  summary?: string | null;
  recording_url?: string | null;
  quality_dimensions?: Record<string, unknown> | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  name: string;
  business_id?: string;
  vapi_assistant_id?: string | null;
  phone_number?: string | null;
  prompts?: Record<string, unknown>;
  voice?: { provider?: string; voiceId?: string; [key: string]: unknown };
  model?: { provider?: string; model?: string; temperature?: number; [key: string]: unknown };
  first_message?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface Lead {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  source?: string | null;
  agent_id?: string | null;
  business_id?: string | null;
  notes?: string | null;
  score?: number | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Transcript {
  call_id: string;
  conversation_id?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  status?: string;
  duration?: number | null;
  summary?: string | null;
  transcript?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface PhoneNumber {
  id?: string;
  phone_number: string;
  agent_id?: string | null;
  business_id?: string | null;
  capabilities?: Record<string, boolean>;
  compliance?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Workspace {
  id: string;
  name: string;
  lifecycle_state?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  description?: string | null;
  is_active?: boolean;
  webhook_secret_masked?: string;
  [key: string]: unknown;
}

export interface EvalScenario {
  id: string;
  agent_id: string;
  business_id?: string;
  vapi_eval_id?: string;
  name: string;
  description?: string | null;
  messages?: unknown[];
  created_at?: string;
  [key: string]: unknown;
}

export interface EvalRun {
  run_id?: string;
  vapi_run_id?: string;
  status: string;
  passed?: boolean | null;
  results?: unknown[];
  [key: string]: unknown;
}

export interface Paginated<TKey extends string, TItem> {
  has_more?: boolean;
  [key: string]: unknown;
}

export interface SignupResult {
  api_key: string;
  business_id: string;
  agent_id: string | null;
  phone_number: string | null;
  dashboard_url?: string;
  trial_ends_at?: string;
  provisioning_deferred?: boolean;
  payment_capture?: string;
  checkout_url?: string;
  dashboard_magic_link?: string;
  [key: string]: unknown;
}
