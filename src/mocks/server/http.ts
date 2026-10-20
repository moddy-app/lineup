/** Response helpers: JSON bodies, status codes and headers. */

export interface Reply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export const ok = (body: unknown, headers?: Record<string, string>): Reply => ({status: 200, body, headers});
export const created = (body: unknown): Reply => ({status: 201, body});
export const noContent = (): Reply => ({status: 204});

export function toResponse(reply: Reply): Response {
  const headers = new Headers(reply.headers);
  if (reply.status === 204 || reply.body === undefined) return new Response(null, {status: reply.status, headers});
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(reply.body), {status: reply.status, headers});
}
