import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { html } = await req.json();

    if (!html) {
      return NextResponse.json({ error: "No HTML provided" }, { status: 400 });
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  html, body { 
    margin: 0; 
    padding: 0;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: #000;
  }
  #composition {
    width: 100%;
    height: 100%;
    position: relative;
  }
  [data-start] {
    opacity: 0;
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>
<body>
${html}
<script>
document.addEventListener('DOMContentLoaded', function() {
  const elements = document.querySelectorAll('[data-start]');
  
  elements.forEach(function(el) {
    const start = parseFloat(el.getAttribute('data-start') || '0');
    const duration = parseFloat(el.getAttribute('data-duration') || '2');
    
    el.style.opacity = '0';
    
    setTimeout(function() {
      if (typeof gsap !== 'undefined') {
        gsap.to(el, { opacity: 1, duration: 0.5, ease: "power2.out" });
        setTimeout(function() {
          gsap.to(el, { opacity: 0, duration: 0.3 });
        }, duration * 1000);
      } else {
        el.style.opacity = '1';
      }
    }, start * 1000);
  });

  const staticElements = document.querySelectorAll('#composition > *:not([data-start])');
  staticElements.forEach(function(el) {
    el.style.opacity = '1';
  });
});
</script>
</body>
</html>`;

    return new NextResponse(fullHtml, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": "attachment; filename=composition.html",
      },
    });

  } catch (e) {
    console.error("Render route error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Render failed" },
      { status: 500 }
    );
  }
}