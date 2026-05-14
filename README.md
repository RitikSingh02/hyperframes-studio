# 🎬 Hyperframes Studio

An AI-powered video composition app built for the Soundverse internship assignment.

## Live Demo
🌐 https://hyperframes-studio.vercel.app/

## What it does
- Type a prompt describing your video
- AI generates a Hyperframes HTML composition
- Live preview plays in the browser with animations
- Download the composition as HTML file

## Tech Stack
- **Frontend**: Next.js 15, Tailwind CSS
- **Backend**: Next.js API Routes
- **LLM**: OpenRouter API
- **Animations**: GSAP
- **Framework**: Hyperframes by HeyGen

## Features
- ✅ Chat interface with conversation history
- ✅ AI generates valid Hyperframes HTML compositions
- ✅ Live animated preview with play/pause controls
- ✅ Progress bar showing video timeline
- ✅ Iterative editing via chat
- ✅ Download composition as HTML

## How to Run Locally (For Developers)
1. Clone the repo
2. Install dependencies: `npm install`
3. Create `.env.local` file:
   `OPENROUTER_API_KEY=your_key_here`
4. Run: `npm run dev`
5. Open `http://localhost:3000`

## Limitations & Future Improvements
- Video export as MP4 requires FFmpeg + Puppeteer server setup
- Currently exports as animated HTML file
- Free tier API has rate limits
- Would add aspect ratio presets (9:16, 1:1) with more time
- Would add voice over generation with more time

## Built By
Ritik Singh
