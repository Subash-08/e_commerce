/** External references are rendered by the browser, never fetched by our server or image optimizer. */
export function isPublicImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      host.includes(".") &&
      !host.includes(":") &&
      !/^\d+(?:\.\d+){3}$/.test(host) &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
    );
  } catch {
    return false;
  }
}
