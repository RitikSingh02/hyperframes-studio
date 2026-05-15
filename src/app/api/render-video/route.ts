/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";

ffmpeg.setFfmpegPath(ffmpegPath);

const FRAME_RATE = 24;
const WIDTH = 1280;
const HEIGHT = 720;

function buildFullHtml(compositionHtml: string, durationSeconds: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: #000;
  }
  #composition {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    position: relative;
    overflow: hidden;
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>
<body>
${compositionHtml}
<script>
window.__hf_duration = ${durationSeconds};
window.__hf_ready = false;

document.addEventListener('DOMContentLoaded', function() {
  var layers = Array.from(document.querySelectorAll('[data-track-index]'));

  layers.forEach(function(el) {
    var start    = parseFloat(el.getAttribute('data-start')    || '0');
    var duration = parseFloat(el.getAttribute('data-duration') || '2');
    var animAttr = el.getAttribute('data-animation');

    var from = { opacity: 0 };
    var to   = { opacity: 1, duration: 0.6 };

    if (animAttr) {
      try {
        var cfg = JSON.parse(animAttr);
        if (cfg.from) from = cfg.from;
        if (cfg.to)   to   = cfg.to;
      } catch(e) {}
    }

    gsap.set(el, from);
    gsap.to(el, Object.assign({}, to, { delay: start }));
    gsap.to(el, { opacity: 0, duration: 0.3, delay: start + duration - 0.3 });
  });

  window.__hf_ready = true;
});
</script>
</body>
</html>`;
}

async function extractDuration(html: string): Promise<number> {
  const match = html.match(/id=["']composition["'][^>]*data-duration=["']([^"']+)["']/);
  if (match) return parseFloat(match[1]) || 10;

  let max = 10;
  const re = /data-start=["']([^"']+)["'][^>]*data-duration=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const end = parseFloat(m[1]) + parseFloat(m[2]);
    if (end > max) max = end;
  }
  return max;
}

export async function POST(req: NextRequest) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-render-"));
  const framesDir = path.join(tmpDir, "frames");
  const outputPath = path.join(tmpDir, "output.webm");
  fs.mkdirSync(framesDir);

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    const { html } = await req.json();
    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "No HTML provided" }, { status: 400 });
    }

    const durationSeconds = await extractDuration(html);
    const totalFrames = Math.ceil(durationSeconds * FRAME_RATE);
    const fullHtml = buildFullHtml(html, durationSeconds);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        `--window-size=${WIDTH},${HEIGHT}`,
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT });
    await page.setContent(fullHtml, { waitUntil: "load" });
    await page.waitForFunction("window.__hf_ready === true", { timeout: 10000 });

    // Pause GSAP and scrub frame by frame
    await page.evaluate(() => {
      // @ts-expect-error -- gsap global
      gsap.ticker.remove(gsap.updateRoot);
      // @ts-expect-error -- gsap global
      gsap.globalTimeline.pause();
    });

    for (let i = 0; i < totalFrames; i++) {
      const timeSeconds = i / FRAME_RATE;
      await page.evaluate((t: number) => {
        // @ts-expect-error -- gsap global
        gsap.globalTimeline.seek(t, false);
      }, timeSeconds);

      const framePath = path.join(framesDir, `frame-${String(i).padStart(6, "0")}.png`);
      await page.screenshot({ path: framePath as `${string}.png`, type: "png" });
    }

    await browser.close();
    browser = undefined;

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(framesDir, "frame-%06d.png"))
        .inputFPS(FRAME_RATE)
        .videoCodec("libvpx-vp9")
        .outputOptions([
          "-crf 33",
          "-b:v 0",
          `-r ${FRAME_RATE}`,
          `-s ${WIDTH}x${HEIGHT}`,
          "-pix_fmt yuv420p",
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/webm",
        "Content-Disposition": `attachment; filename="composition.webm"`,
        "Content-Length": String(videoBuffer.byteLength),
      },
    });
  } catch (e) {
    console.error("[render-video] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Render failed" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
