import { NextRequest, NextResponse } from "next/server";

// broader sports-topic detector
function isSportsy(s: string) {
  const t = s.toLowerCase();
  return /score|result|match|fixture|stadium|city|who scored|scorer|tournament|football|team|vs|play(ing)?|won|winner|cup|league/.test(t);
}

export async function POST(req: NextRequest) {
  let text: string;
  try {
    const body = await req.json();
    text = body.text;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey || !isSportsy(text)) {
      return NextResponse.json({ text, usedModel: "none" }, { status: 200 });
    }

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3.1:free",
        messages: [
          { role: "system", content: "Rewrite the factual sports answer in one friendly sentence. Keep facts, add nothing." },
          { role: "user", content: text }
        ],
        max_tokens: 80,
        temperature: 0.2
      })
    });

    const data = await r.json();
    const out = data?.choices?.[0]?.message?.content?.trim() || text;
    return NextResponse.json({ text: out, usedModel: "deepseek/deepseek-chat-v3.1:free" });
  } catch {
    return NextResponse.json({ text: "Error processing request", usedModel: "fallback" }, { status: 200 });
  }
}
