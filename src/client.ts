export interface KaiCallsOptions {
  apiKey: string;
  /** Override the API origin. Default: https://www.kaicalls.com */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default: 30000. */
  timeoutMs?: number;
  /** Custom fetch implementation (for testing or polyfills). */
  fetch?: typeof fetch;
}

export interface KaiCallsErrorBody {
  code: string;
  message: string;
}

export class KaiCallsError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = 'KaiCallsError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
}

const DEFAULT_BASE_URL = 'https://www.kaicalls.com';

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: KaiCallsOptions) {
    if (!options.apiKey) {
      throw new Error('KaiCalls: apiKey is required (kc_live_...)');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  /**
   * Raw request escape hatch — call any KaiCalls endpoint, including ones
   * not yet wrapped by a resource method. `path` is relative to the origin,
   * e.g. '/api/v1/calls'.
   */
  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) url.searchParams.append(key, v);
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new KaiCallsError(0, 'timeout', `Request timed out after ${this.timeoutMs}ms`, null);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const errBody = (data as { error?: KaiCallsErrorBody } | null)?.error;
      throw new KaiCallsError(
        response.status,
        errBody?.code ?? `http_${response.status}`,
        errBody?.message ?? `KaiCalls API error (HTTP ${response.status})`,
        data,
      );
    }

    return data as T;
  }
}
