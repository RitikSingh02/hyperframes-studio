````md
# 🎬 Hyperframes Studio

AI-powered cinematic video composition generator built for the Soundverse Software Engineer Internship assignment.

## 🌐 Live Demo
https://hyperframes-studio.vercel.app/

---

# 🚀 What It Does

Hyperframes Studio lets users generate animated video compositions using natural language prompts.

Users can:
- Describe a video idea in plain English
- Generate cinematic multi-scene compositions using AI
- Preview animations live in the browser
- Iteratively edit the composition through chat
- Export the final composition as `.webm`

---

# ✨ Features

- ✅ AI-powered cinematic scene generation
- ✅ Smart single-scene vs multi-scene composition logic
- ✅ Live animated preview player
- ✅ Downloadable `.webm` video rendering
- ✅ Chat-based iterative editing workflow
- ✅ Timeline progress bar and playback controls
- ✅ Conversation history
- ✅ Prompt suggestion chips
- ✅ Undo functionality
- ✅ Auto-retry for invalid AI outputs
- ✅ Pixel-perfect preview scaling matching exported video

---

# 🛠️ Tech Stack

## Frontend
- Next.js 15
- React
- Tailwind CSS

## Backend
- Next.js API Routes

## AI / LLM
- OpenRouter API
- DeepSeek model

## Rendering & Animation
- GSAP Animations
- Puppeteer
- FFmpeg

## Composition System
- Hyperframes-compatible composition schema

---

# 🎥 How It Works

1. User enters a prompt describing the video
2. LLM generates a cinematic HTML composition
3. Composition uses:
   - `data-start`
   - `data-duration`
   - `data-track-index`
   - animation adapters
4. Preview renders live in the browser
5. Puppeteer + FFmpeg generate downloadable `.webm` output

---

# 💻 Run Locally

## 1. Clone Repository

```bash
git clone https://github.com/RitikSingh02/hyperframes-studio.git
cd hyperframes-studio
````

## 2. Install Dependencies

```bash
npm install
```

## 3. Create `.env.local`

```env
OPENROUTER_API_KEY=your_api_key_here
```

## 4. Run Development Server

```bash
npm run dev
```

## 5. Open In Browser

```text
http://localhost:3000
```

---

# ⚠️ Notes & Limitations

* The project currently uses a custom GSAP-based runtime following Hyperframes-compatible composition structure
* OpenRouter free-tier responses may occasionally take a few extra seconds
* Output quality depends on prompt complexity
* Official `@hyperframes/player` and `@hyperframes/engine` integration was not fully completed due to time and debugging constraints

---

# 🔮 Future Improvements

* Official Hyperframes runtime integration
* Better cinematic transitions
* Voice-over generation
* More aspect ratio presets (9:16, 1:1)
* Asset uploads (images/audio/video)
* Template library
* Better scene orchestration
* Faster rendering pipeline

---

# 👨‍💻 Built By

Ritik Singh

```
```
