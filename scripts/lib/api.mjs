export async function postEvents({ apiUrl, token, events, sessions = [], fetchImpl = fetch, timeoutMs = 5000 }) {
  try {
    const res = await fetchImpl(`${apiUrl}/api/ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(sessions.length ? { events, sessions } : { events }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}
