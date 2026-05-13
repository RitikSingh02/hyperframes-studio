"use client";

import { useState } from "react";

const PREVIEW_FALLBACK_HTML =
  '<p style="margin:1rem;font-family:system-ui,sans-serif;color:#666">Unexpected response from server.</p>';

function buildIframeSrcDoc(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  html, body { 
    margin: 0; padding: 0;
    width: 100%; height: 100vh;
    overflow: hidden;
    font-family: system-ui, sans-serif;
  }
  #composition {
    width: 100%; 
    height: calc(100vh - 50px);
    position: relative;
  }
  [data-start] { 
    opacity: 0; 
    position: absolute; 
  }
  #controls {
    height: 50px;
    background: #111;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 10px;
    position: fixed;
    bottom: 0;
    width: 100%;
    box-sizing: border-box;
  }
  #playBtn {
    background: white;
    border: none;
    border-radius: 50%;
    width: 32px; height: 32px;
    cursor: pointer;
    font-size: 14px;
    display: flex; 
    align-items: center; 
    justify-content: center;
    flex-shrink: 0;
  }
  #progressBar {
    flex: 1;
    height: 4px;
    background: #444;
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
  }
  #progressFill {
    height: 100%;
    background: #fff;
    width: 0%;
    transition: width 0.1s linear;
  }
  #timeDisplay {
    color: white;
    font-size: 12px;
    min-width: 60px;
    text-align: right;
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>
<body>
${html}
<div id="controls">
  <button id="playBtn">▶</button>
  <div id="progressBar"><div id="progressFill"></div></div>
  <div id="timeDisplay">0s / 10s</div>
</div>
<script>
document.addEventListener('DOMContentLoaded', function() {
  const elements = document.querySelectorAll('[data-start]');
  const playBtn = document.getElementById('playBtn');
  const progressFill = document.getElementById('progressFill');
  const timeDisplay = document.getElementById('timeDisplay');

  // Find total duration
  let totalDuration = 10;
  elements.forEach(function(el) {
    const start = parseFloat(el.getAttribute('data-start') || '0');
    const dur = parseFloat(el.getAttribute('data-duration') || '2');
    if (start + dur > totalDuration) totalDuration = start + dur;
  });

  timeDisplay.textContent = '0s / ' + totalDuration + 's';

  let isPlaying = false;
  let interval = null;
  let timeouts = [];

  function clearAllTimeouts() {
    timeouts.forEach(function(t) { clearTimeout(t); });
    timeouts = [];
  }

  function resetElements() {
    elements.forEach(function(el) {
      gsap.set(el, { opacity: 0 });
    });
  }

  function playComposition() {
    clearAllTimeouts();
    resetElements();
    isPlaying = true;
    playBtn.textContent = '⏸';

    elements.forEach(function(el) {
      const start = parseFloat(el.getAttribute('data-start') || '0');
      const duration = parseFloat(el.getAttribute('data-duration') || '2');

      const t1 = setTimeout(function() {
        gsap.to(el, { opacity: 1, duration: 0.5, ease: 'power2.out' });
      }, start * 1000);

      const t2 = setTimeout(function() {
        gsap.to(el, { opacity: 0, duration: 0.3 });
      }, (start + duration) * 1000);

      timeouts.push(t1, t2);
    });

    if (interval) clearInterval(interval);
    const startTime = Date.now();
    interval = setInterval(function() {
      const currentTime = (Date.now() - startTime) / 1000;
      const pct = Math.min((currentTime / totalDuration) * 100, 100);
      progressFill.style.width = pct + '%';
      timeDisplay.textContent = Math.floor(currentTime) + 's / ' + totalDuration + 's';

      if (currentTime >= totalDuration) {
        clearInterval(interval);
        clearAllTimeouts();
        isPlaying = false;
        playBtn.textContent = '▶';
        progressFill.style.width = '0%';
        timeDisplay.textContent = '0s / ' + totalDuration + 's';
        resetElements();
      }
    }, 100);
  }

  playBtn.addEventListener('click', function() {
    if (isPlaying) {
      clearInterval(interval);
      clearAllTimeouts();
      isPlaying = false;
      playBtn.textContent = '▶';
    } else {
      playComposition();
    }
  });

  // Auto play on load
  setTimeout(playComposition, 500);
});
</script>
</body>
</html>`;
}

async function requestHtml(prompt: string, currentHtml: string): Promise<string> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, currentHtml }),
  });

  const raw = await res.text();
  let data: { html?: string; error?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Unexpected response from server");
  }

  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }

  if (typeof data.html !== "string" || data.html.trim() === "") {
    return PREVIEW_FALLBACK_HTML;
  }

  return data.html.trim();
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", text: "Hi — describe the video you want to create!" },
  ]);

  async function handleSend() {
    const text = prompt.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);
    setPreviewError(null);

    try {
      const html = await requestHtml(text, previewHtml || "");
      setPreviewHtml(html);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "✅ Done! Preview updated on the right. You can keep editing by typing more instructions.",
      }]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      setPreviewError(errMsg);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `❌ Error: ${errMsg}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!previewHtml) return;
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: previewHtml }),
      });
      if (!res.ok) throw new Error("Render failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "composition.html";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed: " + (e instanceof Error ? e.message : "unknown error"));
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="shrink-0 border-b border-[var(--border)] px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <span className="text-sm font-medium tracking-tight">🎬 Hyperframes Studio</span>
          <span className="text-xs text-[var(--muted)]">Next.js · Tailwind · Gemini</span>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-0 border-x border-[var(--border)] lg:flex-row">
        {/* Chat Panel */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
            <h1 className="text-sm font-semibold">Chat</h1>
            <p className="text-xs text-[var(--muted)]">Describe your video composition</p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm">
                  ⏳ Generating...
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]/80 p-3 backdrop-blur-sm">
            <div className="flex gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-1.5 shadow-sm">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="e.g. Make a 10 second intro with blue background and white title..."
                rows={2}
                className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
              />
              <button
                type="button"
                disabled={loading || !prompt.trim()}
                onClick={() => void handleSend()}
                className="self-end rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs font-medium text-[var(--background)] transition hover:opacity-90 disabled:opacity-40"
              >
                {loading ? "⏳" : "Send"}
              </button>
            </div>
            <p className="mt-1 text-center text-xs text-[var(--muted)]">Ctrl+Enter to send</p>
          </div>
        </section>

        {/* Preview Panel */}
        <section className="flex min-h-[40vh] w-full shrink-0 flex-col bg-[var(--surface)] lg:min-h-0 lg:w-[min(480px,42vw)] lg:max-w-xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Preview</h2>
              <p className="text-xs text-[var(--muted)]">Live composition output</p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!previewHtml}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--foreground)]/20 hover:text-[var(--foreground)] disabled:opacity-40"
            >
              Download HTML
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-6">
            {previewError && (
              <p className="mb-3 shrink-0 text-center text-xs text-red-600 dark:text-red-400">
                {previewError}
              </p>
            )}
            <div className="aspect-video w-full max-w-full flex-1 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/50 lg:aspect-auto lg:min-h-0">
              {previewHtml !== null ? (
                <iframe
                  key={previewHtml}
                  title="Generated preview"
                  className="h-full min-h-[200px] w-full rounded-[inherit] border-0 bg-black"
                  sandbox="allow-same-origin allow-scripts"
                  srcDoc={buildIframeSrcDoc(previewHtml)}
                />
              ) : (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-[var(--border)]" aria-hidden />
                  <p className="text-sm text-[var(--muted)]">Preview will appear here</p>
                  <p className="text-xs text-[var(--muted)]">Type a prompt and click Send</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}