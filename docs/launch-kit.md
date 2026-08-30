# Memory Wallet — Launch Kit (v0.8)

> Audience: mainstream ChatGPT/Claude users. Tone: plain, no jargon. Trust anchor: open source + local-only.

---

## 1. Landing page copy

### Headlines — pick one (A is the current tagline, kept as option)

**A. Your AI memory. Your rules.**
Sub: ChatGPT remembers you. Shouldn't you decide what it remembers? Memory Wallet lets you own the memory you share — AI apps ask, you approve, nothing leaves your device.

**B. Stop letting AI remember you without asking.**
Sub: Memory Wallet puts a permission gate between your memories and every AI you use. You choose the profile, you see exactly what will be shared, then you allow — or don't. 100% on-device.

**C. One wallet for everything AI knows about you.**
Sub: Work, personal, side projects — keep them separate. When ChatGPT or Claude wants context, Memory Wallet shows you the request, the reason, and the preview. One click to share. Open source, local-only.

### Feature blocks (use real UI names/screenshots)

**1. AI asks. You decide.**
When you hit Enter, your message pauses and a Memory Request card appears — who is asking, which profile, what info, why, and a preview of the memories that will be shared. Allow shares context + question together. Deny sends your question unchanged. No surprises.

**2. Profiles are boundaries. Not folders.**
Startup ≠ Work ≠ Personal. Each profile is a separate context. Switch the active profile in the popup — the on-page pill updates live. The card even lets you tap a different profile before you allow.

**3. Nothing leaves this device. Ever. And you can verify it.**
No backend, no account, no analytics. Memories live in your browser's local storage. The code is open source — [github.com/Souhadra/Memory_Wallet](https://github.com/Souhadra/Memory_Wallet) — so you don't have to take our word for it.

### How it works (3 steps, matches the wizard)

1. **Set up in 30 seconds** — import your real ChatGPT memory JSON, load sample data, or start empty. Pick your active profile.
2. **Ask AI normally** — on ChatGPT or Claude, type your question and press Enter.
3. **Approve and send** — review the preview, pick Once / Session / Always, hit Allow. The AI answers with your context.

### Social proof / trust strip (pre-launch placeholder)

> Local-only prototype · Works on ChatGPT & Claude · Open source · No data leaves your device

After you have 5–10 beta users, replace with a single quote: *"Finally I can let ChatGPT help with LIBRO without pasting my whole background every time."*

### FAQ

**Is my data safe?**
Yes. Everything is stored in `chrome.storage.local` on your device. There is no server. If you uninstall the extension, the data is gone unless you exported it. The repo is public so anyone can audit what the extension does.

**Which AI apps work?**
ChatGPT (`chatgpt.com`) and Claude (`claude.ai`) today. More providers are added via one small adapter file each — Gemini is next on the list.

**What does it cost?**
Free during the beta/validation period.

**What if ChatGPT updates its site and breaks the extension?**
Detection lives in one file per provider (`src/providers/chatgpt.ts`). We ship fixes quickly, and the on-page pill lets you manually re-trigger sharing if auto-detection misses a send.

**Can I bring my existing ChatGPT memories?**
Yes. Dashboard → Memories → Import ChatGPT memory JSON. Paste the list from Settings → Personalization → Memory → Manage, or import your data-export `memories.json`. Duplicates are skipped, categories inferred.

### CTA section

**Head:** Be first to try it.
**Body:** Join the waitlist — we'll invite a small beta group as the storage layer stabilizes. No spam, one email when your invite is ready.
**Fields:** Email + one optional question (see Validation kit below)
**Button:** Join waitlist
**Microcopy below button:** Open source · Local-only · Unsubscribe anytime.

### Meta (SEO / social)

- **Title:** Memory Wallet — Your AI memory. Your rules. (Local-first, open source)
- **Description:** Own the memory you share with AI. Memory Wallet is a local-first browser extension where ChatGPT and Claude must ask before they access your memories. You preview, you approve, nothing leaves your device.
- **OG image suggestion:** Screenshot of the permission card on top of a blurred ChatGPT chat, with the pill visible bottom-right. No mockups.

---

## 2. Demo script — 45–60s GIF / video

**Goal:** Prove the core loop in one take. No voiceover needed — captions do the work.

**Setup (before recording):**
- Chrome 110% zoom, bookmarks bar hidden, one clean ChatGPT tab, new chat.
- Wallet seeded: Startup profile active with 3–4 memories about "LIBRO — library chatbot, Vectorless RAG" (use sample data or your real import). Popup shows Startup active.
- Screen recorder at 1080p, cursor at normal speed. No other extensions visible.

| Shot | What to do | On-screen caption | Duration |
|------|------------|-------------------|----------|
| 1 | Show popup: Startup (🚀) active, 7 memories. Close it. | `Your AI memory. Your rules.` | 4s |
| 2 | In ChatGPT composer, type: *"I'm working on my library chatbot LIBRO — what architecture should I use?"* — press Enter. | `Ask AI normally.` | 5s |
| 3 | Message visibly pauses; Memory Request card slides in top-right. Pause 1s so viewer reads: profile, categories, reason, READ ONLY, preview of 2–3 memories. | `Your message pauses. AI asks for permission.` | 7s |
| 4 | Hover the preview, then click **Once → Allow**. Composer fills with `[Memory Wallet Context]` + question and sends as one message. | `You see exactly what will be shared. Then you allow.` | 8s |
| 5 | ChatGPT answers referencing your memories (e.g., "Vectorless RAG on Render"). Highlight one phrase. | `The answer uses your memory.` | 6s |
| 6 | Quick cut: open popup → switch to Work (💼) → pill bottom-right animates from `🚀 Startup` to `💼 Work`. | `Work ≠ Personal. You choose.` | 6s |

**End card (2s):** `Memory Wallet — Local-only · Open source` + waitlist URL.

**Export:** GIF ≤15MB for landing hero (loop shots 2–5), full video for X/Reddit.

---

## 3. Launch posts

### Reddit — r/ChatGPT (or r/LocalLLaMA if you want more technical eyes)

**Title:** I built a browser extension where ChatGPT has to ask before it accesses your memories

**Body:**
I was tired of ChatGPT remembering things about me with no way to control what it actually uses.

So I built Memory Wallet — a local-first Chrome extension. When you press Enter on ChatGPT or Claude, your message pauses and a permission card appears: who is asking, which profile (Work / Personal / Startup), what info, why, and a preview of the memories that will be shared. You hit Allow and it sends context + question together. Deny sends your question unchanged.

Everything stays on your device — no backend, no account. Code is open source: github.com/Souhadra/Memory_Wallet

It's a prototype (v0.8) — works on ChatGPT and Claude, ~30MB local model for semantic matching, one-time download then offline.

Looking to validate if people actually want this. If you do, join the waitlist [link] — inviting a small beta as the storage layer settles. Happy to answer anything, and brutal feedback welcome.

[attach demo GIF]

### X / Twitter — 4-post thread

**1/4** ChatGPT remembers you. But you can't decide *what* it remembers.

I built Memory Wallet — a Chrome extension where AI has to ask before it accesses your memories. You preview, you approve, nothing leaves your device.

Demo:

**2/4** Hit Enter → your message pauses → a card shows who is asking, which profile, and exactly what will be shared.

Allow = context + question sent together.
Deny = your question sent unchanged.

**3/4** Profiles are boundaries. Startup ≠ Work ≠ Personal. Switch in the popup, the on-page pill updates live.

100% local. No backend. Open source: github.com/Souhadra/Memory_Wallet

**4/4** It's a prototype (v0.8) on ChatGPT + Claude. Trying to validate demand before I ship wider.

If you want in → [waitlist link]

What would you trust / not trust about an AI remembering you?

### One-line pitch (bio / directory / Product Hunt tagline)

**Memory Wallet — your AI memory, your rules. A local-first wallet where AI apps must ask before they access your memories.**

---

## 4. Validation kit

### Form (Tally / Formspree — 2 fields)

1. **Email** (required) — label: `Email`
2. **Optional:** `What would you trust — or not trust — about an AI remembering you?` (textarea, placeholder: `e.g., I want it to remember my project context but not my personal notes`)

Keep it to 2 fields. Every extra field halves conversions at this stage.

### Success threshold

- **Signal:** 50–100 emails from 2–3 posts = real demand. Below 20 = rethink positioning or audience.
- **Secondary signal:** reply quality on the open-ended question — look for repeated pains (e.g., "I copy-paste the same context every time").

### UTM tagging (so you know what worked)

Create one link per surface, same destination:

- `?utm_source=reddit&utm_medium=post&utm_campaign=waitlist`
- `?utm_source=x&utm_medium=thread&utm_campaign=waitlist`
- `?utm_source=landing&utm_medium=hero&utm_campaign=waitlist`

Tally shows referrer; or add a hidden field that captures `utm_source`.

### What to do with the list

- One confirmation email: "You're on the list — small beta invites as storage stabilizes. Reply with the hardest thing about AI memory for you?"
- No drip sequence yet. Wait until you have a v0.9 beta worth inviting to.

---

## Notes for you

- Record the demo *after* your new-user test pass — if the wizard or card has rough edges, patch to v0.8.x first so the video shows a clean flow.
- Landing build is yours per your call — this file is copy only. Drop it into whatever stack you use (Framer / Webflow / plain HTML on GitHub Pages all work).
