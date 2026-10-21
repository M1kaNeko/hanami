export function isTrustedUrl(raw: string, dev: boolean): boolean {
  try {
    const url = new URL(raw);
    return dev
      ? url.origin === "http://127.0.0.1:5173"
      : url.protocol === "hanami:" &&
          url.hostname === "app" &&
          !url.port &&
          !url.username &&
          !url.password;
  } catch {
    return false;
  }
}
