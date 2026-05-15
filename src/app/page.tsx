"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const COMP_W = 1280;
const COMP_H = 720;

// ── UNCHANGED: iframe srcdoc builder ─────────────────────────────────────────
function buildIframeSrcDoc(compositionHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width: ${COMP_W}px;
    height: ${COMP_H}px;
    overflow: hidden;
    background: #000;
    font-family: system-ui, sans-serif;
  }
  #composition {
    width: ${COMP_W}px;
    height: ${COMP_H}px;
    position: relative;
    overflow: hidden;
  }
  #hf-controls {
    position: fixed; bottom: 0; left: 0; right: 0;
    height: 44px;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(8px);
    display: flex; align-items: center;
    padding: 0 14px; gap: 10px;
    border-top: 1px solid rgba(255,255,255,0.08);
    z-index: 9999;
  }
  #hf-play {
    background: #fff; border: none; border-radius: 50%;
    width: 28px; height: 28px;
    cursor: pointer; font-size: 11px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: opacity 0.2s;
  }
  #hf-play:hover { opacity: 0.75; }
  #hf-progress {
    flex: 1; height: 4px;
    background: rgba(255,255,255,0.18);
    border-radius: 2px; overflow: hidden; cursor: pointer;
  }
  #hf-fill {
    height: 100%; background: #3b82f6;
    width: 0%; transition: width 0.08s linear;
    border-radius: 2px;
  }
  #hf-time {
    color: rgba(255,255,255,0.65);
    font-size: 11px; min-width: 66px; text-align: right;
  }
  #hf-badge {
    color: #3b82f6; font-size: 10px;
    font-weight: 700; letter-spacing: 0.06em; opacity: 0.85;
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>
<body>

${compositionHtml}

<div id="hf-controls">
  <button id="hf-play">▶</button>
  <div id="hf-progress"><div id="hf-fill"></div></div>
  <div id="hf-time">0s / 0s</div>
  <span id="hf-badge">HYPERFRAMES</span>
</div>

<script>
(function() {
  var playBtn = document.getElementById('hf-play');
  var fill    = document.getElementById('hf-fill');
  var timeEl  = document.getElementById('hf-time');
  var layers  = Array.from(document.querySelectorAll('[data-track-index]'));

  var root = document.getElementById('composition');
  var totalDuration = (root && root.getAttribute('data-duration'))
    ? parseFloat(root.getAttribute('data-duration'))
    : 10;

  layers.forEach(function(el) {
    var s = parseFloat(el.getAttribute('data-start') || '0');
    var d = parseFloat(el.getAttribute('data-duration') || '2');
    if (s + d > totalDuration) totalDuration = s + d;
  });

  timeEl.textContent = '0s / ' + Math.round(totalDuration) + 's';

  var isPlaying = false;
  var ticker = null;
  var timeouts = [];
  var startTimestamp = 0;

  function clearAll() {
    for (var i = 0; i < timeouts.length; i++) clearTimeout(timeouts[i]);
    timeouts = [];
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  function resetLayers() {
    layers.forEach(function(el) {
      gsap.killTweensOf(el);
      gsap.set(el, { opacity: 0, x: 0, y: 0, scale: 1, rotation: 0 });
    });
  }

  function playComposition() {
    clearAll();
    resetLayers();
    isPlaying = true;
    playBtn.textContent = '⏸';
    startTimestamp = Date.now();

    layers.forEach(function(el) {
      var start    = parseFloat(el.getAttribute('data-start')    || '0');
      var duration = parseFloat(el.getAttribute('data-duration') || '10');
      var animAttr = el.getAttribute('data-animation');

      var fromProps = { opacity: 0 };
      var toProps   = { opacity: 1, duration: 0.6, ease: 'power2.out' };

      if (animAttr) {
        try {
          var cfg = JSON.parse(animAttr);
          if (cfg.from) fromProps = cfg.from;
          if (cfg.to)   toProps   = Object.assign({ duration: 0.6 }, cfg.to);
        } catch(e) {}
      }

      gsap.set(el, fromProps);

      var t1 = setTimeout(function() { gsap.to(el, toProps); }, start * 1000);
      timeouts.push(t1);

      var endsAt = start + duration;
      if (endsAt < totalDuration - 1.5) {
        var t2 = setTimeout(function() {
          gsap.to(el, { opacity: 0, duration: 0.4, ease: 'power1.in' });
        }, (endsAt - 0.4) * 1000);
        timeouts.push(t2);
      }
    });

    ticker = setInterval(function() {
      var elapsed = (Date.now() - startTimestamp) / 1000;
      var pct = Math.min(elapsed / totalDuration * 100, 100);
      fill.style.width = pct + '%';
      timeEl.textContent = Math.floor(elapsed) + 's / ' + Math.round(totalDuration) + 's';

      if (elapsed >= totalDuration) {
        clearAll();
        resetLayers();
        isPlaying = false;
        playBtn.textContent = '▶';
        fill.style.width = '0%';
        timeEl.textContent = '0s / ' + Math.round(totalDuration) + 's';
      }
    }, 80);
  }

  playBtn.addEventListener('click', function() {
    if (isPlaying) { clearAll(); isPlaying = false; playBtn.textContent = '▶'; }
    else { playComposition(); }
  });

  setTimeout(playComposition, 400);
})();
</script>
</body>
</html>`;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

// ── NEW: parse composition info from HTML ─────────────────────────────────────
function parseCompositionInfo(html: string): { duration: number; layers: number } {
  const durationMatch = html.match(/data-duration=["']([^"']+)["']/);
  const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;
  const layers = (html.match(/data-track-index/g) || []).length;
  return { duration, layers };
}

// ── UNCHANGED: PreviewPane with ResizeObserver scaling ────────────────────────
function PreviewPane({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const recalc = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setScale(Math.min(width / COMP_W, height / COMP_H));
  }, []);

  useEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalc]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-xl bg-black"
      style={{ border: "1px solid rgba(99,102,241,0.25)", boxShadow: "0 0 30px rgba(99,102,241,0.08)" }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: COMP_W,
          height: COMP_H,
          transformOrigin: "center center",
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <iframe
          key={html}
          title="Hyperframes composition preview"
          style={{ width: COMP_W, height: COMP_H, border: "none", display: "block" }}
          sandbox="allow-same-origin allow-scripts allow-popups"
          srcDoc={buildIframeSrcDoc(html)}
        />
      </div>
    </div>
  );
}

// ── Prompt suggestion chips ───────────────────────────────────────────────────
const SUGGESTIONS = [
  "10s product intro, blue gradient",
  "Cinematic launch trailer",
  "Minimal title card, dark mode",
  "Feature showcase, multi-scene",
];

// ── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [prompt, setPrompt]           = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [rendering, setRendering]     = useState(false);
  // NEW: undo stack — stores previous composition HTML
  const [prevHtml, setPrevHtml]       = useState<string | null>(null);
  // NEW: input validation message
  const [inputError, setInputError]   = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      text: 'Hi! Describe the video composition you want to create. For example: "A 10-second product intro with a dark gradient background, bold white title, and a subtle slide-up animation"',
    },
  ]);

  const conversationHistory = useRef<HistoryTurn[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── UNCHANGED core + NEW: input validation + auto-retry + undo snapshot ──
  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? prompt).trim();

    // NEW: input validation
    if (!text) return;
    if (text.length < 5) {
      setInputError("Please describe your composition in a bit more detail.");
      return;
    }
    if (loading) return;
    setInputError(null);

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);
    conversationHistory.current.push({ role: "user", content: text });

    // NEW: snapshot current HTML for undo before replacing it
    if (previewHtml) setPrevHtml(previewHtml);

    // ── core fetch helper (used for auto-retry) ──
    async function doFetch(promptText: string): Promise<string> {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          currentHtml: previewHtml || "",
          conversationHistory: conversationHistory.current.slice(-10),
        }),
      });
      const raw = await res.text();
      let data: { html?: string; error?: string };
      try { data = JSON.parse(raw); }
      catch { throw new Error("Invalid response from server"); }
      if (!res.ok || data.error) throw new Error(data.error || `Server error (${res.status})`);
      const html = (data.html || "").trim();
      if (!html) throw new Error("AI returned empty composition");
      if (!html.includes('id="composition"') && !html.includes("id='composition'")) {
        throw new Error("INVALID_HTML");
      }
      return html;
    }

    try {
      let html: string;
      try {
        html = await doFetch(text);
      } catch (e) {
        // NEW: auto-retry once with stricter instruction if HTML was invalid
        if (e instanceof Error && e.message === "INVALID_HTML") {
          setMessages(prev => [...prev, {
            id: (Date.now() + 0.5).toString(),
            role: "assistant",
            text: "⚠️ First attempt produced invalid HTML — retrying with stricter prompt...",
          }]);
          html = await doFetch(
            text + "\n\nIMPORTANT: Return ONLY the raw <div id=\"composition\" ...>...</div>. No markdown, no backticks, no explanation."
          );
        } else {
          throw e;
        }
      }

      setPreviewHtml(html);
      const reply = "✅ Composition updated! Preview is playing on the right. Type another instruction to iterate.";
      conversationHistory.current.push({ role: "assistant", content: reply });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", text: reply }]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      conversationHistory.current.push({ role: "assistant", content: `Error: ${errMsg}` });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", text: `❌ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  }

  // ── NEW: undo handler ─────────────────────────────────────────────────────
  function handleUndo() {
    if (!prevHtml) return;
    setPreviewHtml(prevHtml);
    setPrevHtml(null);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "assistant",
      text: "↩ Reverted to previous composition.",
    }]);
  }

  // ── UNCHANGED: download logic ─────────────────────────────────────────────
  async function handleDownload() {
    if (!previewHtml || rendering) return;
    setRendering(true);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "assistant",
      text: "⏳ Rendering video... This may take 30–60 seconds. Please wait.",
    }]);

    try {
      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: previewHtml }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Render failed" }));
        throw new Error(err.error || "Render failed");
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "composition.webm"; a.click();
      URL.revokeObjectURL(url);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "🎬 Video downloaded! Check your downloads folder.",
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `❌ Render failed: ${e instanceof Error ? e.message : "unknown error"}`,
      }]);
    } finally {
      setRendering(false);
    }
  }

  // NEW: composition info derived from current HTML
  const compInfo = previewHtml ? parseCompositionInfo(previewHtml) : null;

  return (
    <div className="flex h-dvh flex-col text-white" style={{ background: "#07070f" }}>

      {/* ── Header ── */}
      <header
        className="shrink-0 px-4 py-3"
        style={{
          background: "rgba(10,10,20,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(99,102,241,0.15)",
        }}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
              style={{
                background: "linear-gradient(135deg, #6366f1, #3b82f6)",
                boxShadow: "0 0 16px rgba(99,102,241,0.5)",
              }}
            >
              🎬
            </div>
            <span className="text-sm font-bold tracking-tight">Hyperframes Studio</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
            >
              Beta
            </span>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Next.js · Hyperframes · DeepSeek
          </span>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:flex-row">

        {/* ── Chat Panel ── */}
        <section
          className="flex min-h-0 flex-1 flex-col"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Chat header */}
          <div
            className="shrink-0 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #34d399" }} />
              <h1 className="text-sm font-semibold">Chat</h1>
            </div>
            <p className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Describe or edit your video composition
            </p>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={
                    m.role === "user"
                      ? {
                          background: "linear-gradient(135deg, #4f46e5, #3b82f6)",
                          color: "#fff",
                          boxShadow: "0 4px 15px rgba(79,70,229,0.3)",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.75)",
                        }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Generating</span>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div
            className="shrink-0 p-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* Suggestion chips */}
            {messages.length === 1 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void handleSend(s)}
                    className="rounded-full px-3 py-1 text-xs transition"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.25)",
                      color: "#a5b4fc",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* NEW: input validation error */}
            {inputError && (
              <p className="mb-1.5 text-xs" style={{ color: "#f87171" }}>
                ⚠️ {inputError}
              </p>
            )}

            <div
              className="flex gap-2 rounded-xl p-1.5"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: inputError
                  ? "1px solid rgba(248,113,113,0.4)"
                  : "1px solid rgba(99,102,241,0.2)",
              }}
            >
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (inputError) setInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="e.g. Make a 10 second intro with blue gradient and bold white title..."
                rows={2}
                className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                style={{ color: "#fff" }}
              />
              <button
                type="button"
                disabled={loading || !prompt.trim()}
                onClick={() => void handleSend()}
                className="self-end rounded-lg px-4 py-2 text-xs font-bold text-white transition disabled:opacity-40"
                style={{
                  background: loading || !prompt.trim()
                    ? "rgba(99,102,241,0.3)"
                    : "linear-gradient(135deg, #6366f1, #3b82f6)",
                  boxShadow: loading || !prompt.trim() ? "none" : "0 0 16px rgba(99,102,241,0.4)",
                }}
              >
                {loading ? "⏳" : "Send ↑"}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.15)" }}>
              ⌘/Ctrl + Enter to send
            </p>
          </div>
        </section>

        {/* ── Preview Panel ── */}
        <section
          className="flex min-h-[45vh] w-full shrink-0 flex-col lg:min-h-0 lg:w-[min(560px,46vw)]"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          {/* Preview header */}
          <div
            className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              {previewHtml && (
                <div className="h-2 w-2 rounded-full bg-blue-400" style={{ boxShadow: "0 0 6px #60a5fa" }} />
              )}
              <div>
                <h2 className="text-sm font-semibold">Preview</h2>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Live Hyperframes composition
                </p>
              </div>
            </div>

            {/* NEW: undo + download buttons */}
            <div className="flex items-center gap-2">
              {prevHtml && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  ↩ Undo
                </button>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={!previewHtml || rendering}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-30"
                style={
                  previewHtml && !rendering
                    ? {
                        background: "rgba(99,102,241,0.12)",
                        border: "1px solid rgba(99,102,241,0.35)",
                        color: "#a5b4fc",
                        boxShadow: "0 0 12px rgba(99,102,241,0.15)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.3)",
                      }
                }
              >
                {rendering ? "⏳ Rendering..." : "⬇ Download .webm"}
              </button>
            </div>
          </div>

          {/* NEW: Composition info bar */}
          {compInfo && (
            <div
              className="flex shrink-0 items-center gap-4 px-4 py-2"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: "rgba(99,102,241,0.05)",
              }}
            >
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                ⏱ <span style={{ color: "#a5b4fc" }}>{compInfo.duration}s</span> duration
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                🎞 <span style={{ color: "#a5b4fc" }}>{compInfo.layers}</span> layers
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                📐 <span style={{ color: "#a5b4fc" }}>1280×720</span>
              </span>
            </div>
          )}

          {/* Preview area */}
          <div className="flex min-h-0 flex-1 flex-col p-4">
            {previewHtml !== null ? (
              <div className="min-h-0 flex-1">
                <PreviewPane html={previewHtml} />
              </div>
            ) : (
              <div
                className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl p-6 text-center"
                style={{
                  border: "1px dashed rgba(99,102,241,0.2)",
                  background: "rgba(99,102,241,0.03)",
                }}
              >
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-2xl animate-ping"
                    style={{ background: "rgba(99,102,241,0.15)", animationDuration: "2s" }}
                  />
                  <div
                    className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(59,130,246,0.2))",
                      border: "1px solid rgba(99,102,241,0.3)",
                      boxShadow: "0 0 20px rgba(99,102,241,0.2)",
                    }}
                  >
                    🎬
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Preview will appear here
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Type a prompt or pick a suggestion and click Send
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}