"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const COMP_W = 1280;
const COMP_H = 720;

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

// ── PreviewPane ──────────────────────────────────────────────────────────────
// Renders a true 1280×720 iframe and scales it down with CSS transform
// so every pixel position is IDENTICAL to the rendered video output.
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
      className="relative w-full h-full overflow-hidden rounded-xl border border-white/10 bg-black"
    >
      {/* Staging div: true 1280×720, centered, then scaled down */}
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

// ── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [prompt, setPrompt]           = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [rendering, setRendering]     = useState(false);
  const [messages, setMessages]       = useState<Message[]>([
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

  async function handleSend() {
    const text = prompt.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);
    conversationHistory.current.push({ role: "user", content: text });

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
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

  return (
    <div className="flex h-dvh flex-col bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight">🎬 Hyperframes Studio</span>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Beta</span>
          </div>
          <span className="text-xs text-white/30">Next.js · Hyperframes · DeepSeek</span>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:flex-row">

        {/* ── Chat Panel ── */}
        <section className="flex min-h-0 flex-1 flex-col border-r border-white/10">
          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            <h1 className="text-sm font-semibold">Chat</h1>
            <p className="text-xs text-white/40">Describe or edit your video composition</p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-white/10 bg-white/5 text-white/80"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white/60">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="shrink-0 border-t border-white/10 p-3">
            <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="e.g. Make a 10 second intro with blue gradient and bold white title..."
                rows={2}
                className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30"
              />
              <button
                type="button"
                disabled={loading || !prompt.trim()}
                onClick={() => void handleSend()}
                className="self-end rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
              >
                {loading ? "⏳" : "Send"}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-white/20">⌘/Ctrl + Enter to send</p>
          </div>
        </section>

        {/* ── Preview Panel ── */}
        <section className="flex min-h-[45vh] w-full shrink-0 flex-col bg-black/30 lg:min-h-0 lg:w-[min(560px,46vw)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Preview</h2>
              <p className="text-xs text-white/40">Live Hyperframes composition</p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!previewHtml || rendering}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white disabled:opacity-30"
            >
              {rendering ? "⏳ Rendering..." : "⬇ Download .webm"}
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-4">
            {previewHtml !== null ? (
              <div className="min-h-0 flex-1">
                <PreviewPane html={previewHtml} />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">🎬</div>
                <p className="text-sm text-white/40">Preview will appear here</p>
                <p className="text-xs text-white/20">Type a prompt and click Send</p>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}