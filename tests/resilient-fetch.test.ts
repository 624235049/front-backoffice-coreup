import { describe, expect, it, vi } from 'vitest';
import { REPLAY_SAFE_OPERATIONS } from '@/lib/api-client/replay-safe.gen';
import { createResilientFetch } from '@/lib/resilient-fetch';

const URL_ = 'https://shop.test/v1/bills';
const REPLAY_SAFE = ['POST /v1/bills', 'POST /v1/bills/{id}/void', 'DELETE /v1/customers/{id}'];

function setup(...outcomes: Array<number | Error>) {
  const bodies: string[] = [];
  const send = vi.fn(async (request: Request) => {
    bodies.push(await request.text());
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return new Response(next === 204 ? null : '{}', { status: next ?? 200 });
  });
  return {
    send,
    bodies,
    fetch: createResilientFetch({ fetch: send, delaysMs: [0, 0], replaySafeOperations: REPLAY_SAFE }),
  };
}

function post(body: string, headers: Record<string, string> = {}, signal?: AbortSignal, url = URL_) {
  return new Request(url, { method: 'POST', body, headers, signal });
}

describe('createResilientFetch', () => {
  it('retries a 502 for a POST with Idempotency-Key and resends the same body', async () => {
    const t = setup(502, 502, 200);
    const res = await t.fetch(post('{"total":100}', { 'Idempotency-Key': 'k1' }));
    expect(res.status).toBe(200);
    expect(t.bodies).toEqual(['{"total":100}', '{"total":100}', '{"total":100}']);
  });

  it('retries network errors for GET', async () => {
    const t = setup(new TypeError('Failed to fetch'), 200);
    const res = await t.fetch(new Request(URL_));
    expect(res.status).toBe(200);
    expect(t.send).toHaveBeenCalledTimes(2);
  });

  it('matches path templates segment by segment and for other methods', async () => {
    const t = setup(503, 200, 503, 200, 503, 200);
    const key = { 'Idempotency-Key': 'k1' };
    const voided = await t.fetch(post('{}', key, undefined, 'https://shop.test/v1/bills/b1/void?x=1'));
    const removed = await t.fetch(
      new Request('https://shop.test/v1/customers/c1', { method: 'DELETE', headers: key }),
    );
    // `{id}` is one segment: a deeper path is a different operation
    const deeper = await t.fetch(
      new Request('https://shop.test/v1/customers/c1/notes', { method: 'DELETE', headers: key }),
    );
    expect([voided.status, removed.status, deeper.status]).toEqual([200, 200, 503]);
    expect(t.send).toHaveBeenCalledTimes(5);
  });

  it('sends a public/auth POST once even with Idempotency-Key (the api ignores the key there)', async () => {
    const key = { 'Idempotency-Key': 'k1' };
    for (const path of ['/v1/auth/sign-in/email', '/v1/onboarding/tenants']) {
      const t = setup(502, 200);
      const f = createResilientFetch({ fetch: t.send, delaysMs: [0, 0] }); // default = generated set
      const res = await f(post('{}', key, undefined, `https://shop.test${path}`));
      expect(res.status).toBe(502);
      expect(t.send).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps public endpoints out of the generated replay-safe set and includes tenant mutations', () => {
    expect(REPLAY_SAFE_OPERATIONS).not.toContain('POST /v1/auth/sign-in/email');
    expect(REPLAY_SAFE_OPERATIONS).not.toContain('POST /v1/onboarding/tenants');
    expect(REPLAY_SAFE_OPERATIONS).toContain('POST /v1/bills');
  });

  it('does not retry a POST without Idempotency-Key', async () => {
    const t = setup(502, 200);
    const res = await t.fetch(post('{}'));
    expect(res.status).toBe(502);
    expect(t.send).toHaveBeenCalledTimes(1);
  });

  it('does not retry a network error for a POST without Idempotency-Key', async () => {
    const t = setup(new TypeError('Failed to fetch'), 200);
    await expect(t.fetch(post('{}'))).rejects.toThrow(TypeError);
    expect(t.send).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 409, 422, 500])('does not retry HTTP %i', async (status) => {
    const t = setup(status, 200);
    const res = await t.fetch(post('{}', { 'Idempotency-Key': 'k1' }));
    expect(res.status).toBe(status);
    expect(t.send).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 attempts and returns the last transient response', async () => {
    const t = setup(503, 504, 502, 200);
    const res = await t.fetch(new Request(URL_));
    expect(res.status).toBe(502);
    expect(t.send).toHaveBeenCalledTimes(3);
  });

  it('does not retry after the request was aborted', async () => {
    const controller = new AbortController();
    const send = vi.fn(async () => {
      controller.abort();
      throw new TypeError('Failed to fetch');
    });
    const f = createResilientFetch({ fetch: send, delaysMs: [0, 0], replaySafeOperations: REPLAY_SAFE });
    await expect(f(post('{}', { 'Idempotency-Key': 'k1' }, controller.signal))).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for the backoff when aborted', async () => {
    const controller = new AbortController();
    const send = vi.fn(async () => new Response('{}', { status: 502 }));
    const f = createResilientFetch({ fetch: send, delaysMs: [60_000, 60_000] });
    const pending = f(new Request(URL_, { signal: controller.signal }));
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    controller.abort();
    const res = await pending;
    expect(res.status).toBe(502);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
