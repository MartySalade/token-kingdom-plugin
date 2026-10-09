export function validApiUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}
