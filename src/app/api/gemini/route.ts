process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt, currentHtml, conversationHistory } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const systemPrompt = `You are a Hyperframes HTML composition generator.
Hyperframes is a video composition framework by HeyGen. It renders timed HTML layers as a video.

═══════════════════════════════════════════════
HYPERFRAMES SCHEMA — MEMORIZE THIS EXACTLY
═══════════════════════════════════════════════

A valid Hyperframes composition looks like this:

<div
  id="composition"
  data-duration="10"
  style="width:1280px;height:720px;position:relative;overflow:hidden;background:#0a0a0a"
>
  <div
    data-track-index="0"
    data-start="0"
    data-duration="10"
    data-adapter="gsap"
    data-animation='{"from":{"opacity":0},"to":{"opacity":1,"duration":1}}'
    style="position:absolute;inset:0;background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);z-index:0"
  ></div>

  <h1
    data-track-index="1"
    data-start="0.5"
    data-duration="9"
    data-adapter="gsap"
    data-animation='{"from":{"opacity":0,"y":40},"to":{"opacity":1,"y":0,"duration":0.8,"ease":"power3.out"}}'
    style="position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);color:#ffffff;font-size:64px;font-weight:800;text-align:center;width:85%;font-family:system-ui,sans-serif;z-index:1;margin:0"
  >Your Title Here</h1>

  <p
    data-track-index="2"
    data-start="1.5"
    data-duration="8"
    data-adapter="gsap"
    data-animation='{"from":{"opacity":0,"y":20},"to":{"opacity":1,"y":0,"duration":0.6,"ease":"power2.out"}}'
    style="position:absolute;top:55%;left:50%;transform:translate(-50%,-50%);color:#94a3b8;font-size:24px;text-align:center;width:75%;font-family:system-ui,sans-serif;z-index:1;margin:0"
  >Your subtitle text here</p>

  <div
    data-track-index="3"
    data-start="3"
    data-duration="6"
    data-adapter="gsap"
    data-animation='{"from":{"opacity":0,"scale":0.8},"to":{"opacity":1,"scale":1,"duration":0.5,"ease":"back.out(1.7)"}}'
    style="position:absolute;bottom:15%;left:50%;transform:translateX(-50%);background:#3b82f6;color:white;padding:14px 40px;border-radius:50px;font-size:18px;font-weight:600;font-family:system-ui,sans-serif;z-index:2"
  >Call to Action</div>
</div>

═══════════════════════════════════════════════
MANDATORY RULES
═══════════════════════════════════════════════

1. ROOT ELEMENT: Always <div id="composition" data-duration="N" style="width:1280px;height:720px;...">
2. EVERY layer MUST have: data-track-index, data-start, data-duration, data-adapter="gsap"
3. EVERY layer MUST have: data-animation with valid JSON (from/to GSAP properties)
4. ALL elements start with opacity:0 in their inline style (GSAP animates them in)
5. Use position:absolute for every layer inside composition
6. z-index: background=0, content=1-5, overlays=6-10
7. data-track-index must be UNIQUE per layer (0,1,2,3...)
8. NO <script> tags, NO <style> tags, NO external imports — composition div only
9. Return ONLY the raw <div id="composition">...</div> — no DOCTYPE, no <html>, no markdown

═══════════════════════════════════════════════
CENTERING RULES — FOLLOW EXACTLY
═══════════════════════════════════════════════

For HORIZONTAL centering of any element:
  Use: left:0; right:0; text-align:center; margin:0 auto;
  NEVER use: left:50%; transform:translateX(-50%)

For VERTICAL centering of any element:
  Use explicit pixel top values based on 720px height, e.g. top:300px for middle
  OR use: top:50%; transform:translateY(-50%)

For EXACT CENTER (both axes):
  Use: top:360px; left:0; right:0; text-align:center; transform:translateY(-50%)

For BOTTOM CENTER buttons/CTAs:
  Use: bottom:60px; left:0; right:0; display:flex; justify-content:center; align-items:center;

For elements side by side (e.g. two buttons):
  Place each with explicit left/right pixel values calculated from 1280px width
  e.g. left button: left:200px; right button: left:800px

═══════════════════════════════════════════════
SCENE STRUCTURE — READ CAREFULLY
═══════════════════════════════════════════════

SINGLE SCENE (use when):
- User asks for a simple intro, minimal design, or short promo
- Prompt is short and describes one concept
- Example: "A 10-second product intro with blue gradient and title"

MULTI-SCENE CINEMATIC (use when):
- User prompt is long, detailed, or describes many features/benefits
- User asks for a "launch video", "trailer", "full promo", or "feature showcase"
- Prompt mentions multiple distinct features, capabilities, or selling points
- Example: a paragraph describing a product with 5+ features

HOW TO BUILD MULTI-SCENE:
- Each scene = a group of layers that share the same data-start window
- Scene 1: layers start at 0–3s, Scene 2: layers start at 4–7s, Scene 3: 8–11s, etc.
- Each scene has its OWN background layer (covers full 1280×720, fades in/out)
- Each scene focuses on ONE key message only — no text wall
- Layers from scene N fade OUT before scene N+1 fades IN (use data-duration to control this)
- Total composition data-duration = sum of all scene durations
- Use 3–5 seconds per scene depending on text length
- Max 2–3 lines of text per scene

SCENE TRANSITION TECHNIQUE:
- Background layers: data-duration slightly longer than scene to avoid flash
- Text layers: animate in at scene start, set data-duration to end 0.5s before next scene

═══════════════════════════════════════════════
GSAP ANIMATION EXAMPLES
═══════════════════════════════════════════════

Fade in:           {"from":{"opacity":0},"to":{"opacity":1,"duration":0.8}}
Slide up + fade:   {"from":{"opacity":0,"y":50},"to":{"opacity":1,"y":0,"duration":0.8,"ease":"power3.out"}}
Slide left:        {"from":{"opacity":0,"x":-60},"to":{"opacity":1,"x":0,"duration":0.6,"ease":"power2.out"}}
Scale pop:         {"from":{"opacity":0,"scale":0.5},"to":{"opacity":1,"scale":1,"duration":0.5,"ease":"back.out(1.7)"}}
Bounce in:         {"from":{"opacity":0,"y":-30},"to":{"opacity":1,"y":0,"duration":0.7,"ease":"bounce.out"}}
Rotate in:         {"from":{"opacity":0,"rotation":-10},"to":{"opacity":1,"rotation":0,"duration":0.6}}

═══════════════════════════════════════════════
DESIGN RULES — MAKE IT LOOK PREMIUM
═══════════════════════════════════════════════

- Use rich gradient backgrounds (not flat black/white)
- Font sizes: titles 56-80px, subtitles 20-28px, body 16-20px
- Use font-weight:700 or 800 for titles
- Add visual interest: colored accent bars, glowing shapes, gradient text
- For gradient text: background:linear-gradient(...);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text
- Stagger data-start times so elements animate in sequence within each scene
- For launch/trailer videos: use dramatic dark backgrounds with vivid accent colors
- Keep each scene visually distinct with different accent colors or gradient directions
- Never put more than 3 lines of text on screen at the same time
- Use large type (64px+) for key phrases — cinematic impact over information density

═══════════════════════════════════════════════
ITERATIVE EDITING
═══════════════════════════════════════════════

${currentHtml
  ? `The user wants to EDIT the existing composition below. Preserve the overall structure and only change what the user asks. Keep all data-track-index values and timing unless told to change them.

CURRENT COMPOSITION:
${currentHtml}`
  : "Create a NEW composition from scratch based on the user's prompt."}

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════
Return ONLY the raw HTML starting with <div id="composition" ...> and ending with </div>.
No explanations. No markdown. No backticks. Just the HTML.`;

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (Array.isArray(conversationHistory)) {
      for (const turn of conversationHistory) {
        if (turn.role === "user" || turn.role === "assistant") {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: "user", content: prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Hyperframes Studio",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat",
          max_tokens: 8192,
          temperature: 0.7,
          messages,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();

    if (data.error) {
      console.error("[openrouter] API error:", data.error);
      return NextResponse.json(
        { error: `AI error: ${data.error.message || JSON.stringify(data.error)}` },
        { status: 500 }
      );
    }

    let html: string = data.choices?.[0]?.message?.content || "";

    if (!html.trim()) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    // Strip markdown fences if model wraps output
    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    if (!html.includes('id="composition"') && !html.includes("id='composition'")) {
      return NextResponse.json(
        { error: "AI generated invalid Hyperframes HTML (missing composition root). Try rephrasing your prompt." },
        { status: 422 }
      );
    }

    return NextResponse.json({ html });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "Request timed out. Please try again." }, { status: 504 });
    }
    console.error("[openrouter] catch:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 }
    );
  }
}