process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt, currentHtml } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 });
    }

    const systemPrompt = `You are a Hyperframes HTML composition generator.
Hyperframes renders HTML with data-* attributes as a timed video composition.

CRITICAL RULES:
1. Every element MUST have: data-start, data-duration, data-track-index
2. NEVER overlap elements at the same time - stagger their data-start values
3. Each element needs position:absolute with DIFFERENT top values so they don't overlap
4. Set opacity:0 on every element initially
5. Wrap everything in: <div id="composition" style="width:100%;height:100%;position:relative;background:COLOR">
6. Return ONLY raw HTML - no markdown, no backticks

POSITIONING RULES - VERY IMPORTANT:
- Title: top:20%
- Subtitle: top:45%
- Description: top:55%
- Bottom text: top:80%
- Never put two elements at the same top value

TIMING RULES:
- Elements should appear one after another, not all at once
- Use data-start to stagger: first element at 0s, next at 3s, next at 6s

EXAMPLE of correct output:
<div id="composition" style="width:100%;height:100%;position:relative;background:#000">
  <h1 
    data-start="0" 
    data-duration="10" 
    data-track-index="1"
    style="position:absolute;top:20%;left:50%;transform:translate(-50%,-50%);color:white;font-size:48px;text-align:center;width:80%;opacity:0"
  >Brand Name</h1>
  <p 
    data-start="3" 
    data-duration="7" 
    data-track-index="2"
    style="position:absolute;top:55%;left:50%;transform:translate(-50%,-50%);color:yellow;font-size:20px;text-align:center;width:80%;opacity:0"
  >Description text here</p>
  <p 
    data-start="6" 
    data-duration="4" 
    data-track-index="3"
    style="position:absolute;top:80%;left:50%;transform:translate(-50%,-50%);color:white;font-size:16px;text-align:center;opacity:0"
  >Bottom text</p>
</div>

${currentHtml ? `Current composition to edit:\n${currentHtml}` : "Create a new composition."}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("[openrouter] error:", data.error);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    let html = data.choices?.[0]?.message?.content || "";

    // Clean markdown backticks if LLM adds them
    html = html.replace(/```html/g, "").replace(/```/g, "").trim();

    return NextResponse.json({ html });

  } catch (e) {
    console.error("[openrouter] catch:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 }
    );
  }
}