export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://bakery.local");
    if (url.origin !== "https://bakery.local" || /^\/(?:auth|sign-in|sign-out)(?:\/|$)/.test(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}
