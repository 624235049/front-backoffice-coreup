/** Open redirect guard: only same-origin absolute paths. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

/** `search` for a redirect to /sign-in: remember where the user was, except for the default landing page. */
export function signInSearch(href: string): { redirect?: string } {
  const target = safeRedirect(href);
  return target && target !== '/' ? { redirect: target } : {};
}
