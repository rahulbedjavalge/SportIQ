export type PolishResult = { text: string; usedModel: string };

export async function polishIfEnabled(text: string, enabled: boolean): Promise<PolishResult> {
  if (!enabled) return { text, usedModel: "off" };
  try {
    const r = await fetch("/api/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await r.json();
    return { text: data.text || text, usedModel: data.usedModel || "unknown" };
  } catch {
    return { text, usedModel: "error" };
  }
}
