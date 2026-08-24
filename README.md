# 🔐 Memory Wallet

> **Your AI memory. Your rules.**

A local-first browser extension prototype that lets you own the memory you share with AI
applications. Profiles act as context boundaries; AI apps must *request* access, and you decide.

**How it works on ChatGPT/Claude:** when you press Enter or click Send, your message is paused,
a permission card appears instantly, and only after you ALLOW does `[Memory Wallet Context]`
+ your question go out together — so the answer is generated *with* your memory. DENY sends
your original question unchanged.

This is a validation prototype — not a production product. Everything is stored in
`chrome.storage.local` on your device. There is no backend, no auth, no analytics, no network calls.

---

## Folder structure

```
memplug/
├── package.json               # deps: react, react-dom | dev: esbuild, typescript, @types/chrome
├── tsconfig.json
├── scripts/
│   ├── build.mjs              # esbuild bundling → dist/
│   └── icons.mjs              # generates PNG icons (already run; output committed in src/assets)
├── src/
│   ├── manifest.json          # MV3 manifest (copied to dist/)
│   ├── assets/                # generated icons 16/48/128
│   ├── shared/                # code shared by background, content, popup, options
│   │   ├── types.ts           # Profile / Memory / AIApplication / Permission / MemoryRequest
│   │   ├── constants.ts       # storage keys, categories, category keyword hints
│   │   ├── storage.ts         # chrome.storage.local repos (profiles, memories, permissions…)
│   │   ├── retrieval.ts       # retrieveRelevantMemories(query, profileId) — swap for embeddings later
│   │   ├── permissions.ts     # get/set per (AI app × profile) access level
│   │   ├── actions.ts         # CRUD actions used by popup + dashboard (incl. Load Demo Data)
│   │   ├── messages.ts        # typed runtime message contracts
│   │   └── demoData.ts        # clearly-marked demo profiles + memories, default AI apps/profiles
│   ├── providers/             # AIProviderAdapter abstraction
│   │   ├── types.ts           # adapter interface (detectPage, detectUserQuery, composer, submit)
│   │   ├── chatgpt.ts
│   │   ├── claude.ts
│   │   └── registry.ts
│   ├── background/
│   │   ├── index.ts           # service worker entry
│   │   ├── orchestrator.ts    # permission resolution, request lifecycle, logging
│   │   └── contextBlock.ts    # builds the [Memory Wallet Context] block
│   ├── content/
│   │   ├── index.ts           # wires detector + modal + injector per provider
│   │   ├── detector.ts        # detects newly submitted user messages
│   │   ├── injector.ts        # fills composer with context + question, optional auto-send
│   │   └── ui/
│   │       ├── modal.ts       # reusable Shadow-DOM memory request modal
│   │       └── toast.ts       # status toasts
│   ├── ui/                    # shared React hooks + formatting helpers
│   ├── popup/                 # extension popup (React): profiles, recent requests, demo button
│   └── options/               # full dashboard (React): Overview, Profiles, Memories,
│                              # AI Apps, Permissions, Requests, Settings
└── dist/                      # build output → load this folder as an unpacked extension
```

## Install locally (Chrome)

1. Build once: `npm install` then `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dist/` folder.
5. Pin "Memory Wallet" from the puzzle-piece menu.

For development with rebuild-on-save: `npm run watch`, then hit ↻ on `chrome://extensions`
after changes. Typecheck with `npm run typecheck`.

## Run it up & check (checklist)

1. **Build**: `npm run build` (or `npm run watch` while developing).
2. **Load**: `chrome://extensions` → Developer mode ON → **Load unpacked** → select `dist/`.
   - Changed code? Click ↻ on the Memory Wallet card **and refresh AI tabs**.
3. **Sanity-check the wallet**: click the extension icon.
   - Green ● dot top-right = background service worker responding.
   - Red ○ dot = background failed; open `chrome://extensions` → Memory Wallet →
     **service worker** link → read the console error.
4. **Open chatgpt.com** (a fresh reload matters). You should see a small **🔐 ChatGPT pill**
   bottom-right — that proves the content script is alive.
5. Ask your question normally. Console (`F12`) will show
   `[Memory Wallet] question detected (N chars)` and `[Memory Wallet] query sent to wallet`.
6. The 🔐 request card appears top-right → Allow → context block fills the composer and sends.
7. No card? Click the **pill** — it re-runs sharing for your last question without needing detection.
8. Check **Requests** in the dashboard to see exactly what was logged.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| No pill visible | Content script not injected — hard-refresh the ChatGPT/Claude tab (Ctrl+F5). |
| Pill there, nothing happens on send | Check the page console for `[Memory Wallet]` lines; site markup may have changed — selectors live in `src/providers/chatgpt.ts`. |
| Red status dot in popup | Background worker crashed — open its console via `chrome://extensions`. |
| "Memory Wallet was reloaded — refresh this tab" toast | Extension was reloaded/updated; refresh the AI tab. |

## Importing your real ChatGPT memory JSON

1. Dashboard (**Open Wallet**) → **Memories** → *Import ChatGPT memory JSON*.
2. Pick the target profile (e.g., Personal or Startup).
3. Load either:
   - the memory list copied from **ChatGPT Settings → Personalization → Memory → Manage**, saved as `.json`, or
   - `memories.json` from your ChatGPT **data export**.
4. Click **Import** — duplicates are skipped, categories are inferred by keyword hints,
   everything stays local. Nothing is uploaded anywhere.

The parser accepts arrays of strings, arrays of objects (`content`/`text`/`title`/…),
or wrapper objects like `{ "memories": [...] }`.

## Manual test procedure (the 2-minute demo)

1. Click the Memory Wallet icon → popup opens (green ● = background running).
2. Click **Load Demo Data** → Startup / Work / Personal profiles appear; Startup becomes active.
3. Open https://chatgpt.com and start a new chat. Type:
   *"I'm working on my library chatbot LIBRO — what architecture should I use?"*
4. Press **Enter** — the message does NOT send yet. A 🔐 **Memory Request** card appears instantly
   with "Your message is paused until you decide": profile, requested info, reason, READ ONLY,
   duration radios.
5. Choose **Once** → **Allow** → the composer fills with `[Memory Wallet Context] …` + your
   question and submits as ONE message. ChatGPT answers using your context.
6. Open https://claude.ai in another tab. Ask a related question → same flow → your memories
   travel across AIs.
7. Back in the popup/dashboard check **Requests**: every request logged (app, profile, outcome).
8. Revoke: dashboard → **Permissions** → set ChatGPT × Startup to **Deny**. Next question sends
   normally, no memory shared (denial is logged silently).
9. Optional: Settings → turn OFF "Ask for memory before my message is sent" to compare with the
   old after-send behavior.

## What works

- **Intercept-at-send flow**: pause message → permission card → allow → context + question sent
  together; deny/timeout → original question sent unchanged
- Profiles + manual memory CRUD (create/rename/delete profile; add/edit/delete memory)
- **Import of real ChatGPT memory JSON** into any profile (nested-profile flattener, dedupe,
  category inference)
- Active-profile switching in the popup (wallet metaphor)
- Site detection + send interception for ChatGPT & Claude via provider adapters, with mutation-
  observer fallback and an on-site 🔐 pill for manual re-triggering
- Auto-injection of the content script into already-open AI tabs after install/reload
- Specific permission modal (who / which profile / what info / why / read-only / duration)
- ASK / ALLOW / DENY per (AI app × profile) + ALLOW ONCE + session grants
- Keyword-based relevance scoring (`retrieveRelevantMemories`) returning top-N matches
- Request audit log, recent requests in popup, revoke controls, factory reset
- Local-only mode (always on), demo data marked as `[demo]`

## Known limitations

- **DOM selectors and send interception are fragile** — ChatGPT/Claude markup changes can break
  detection, injection or send-pausing; everything lives in one small file per provider by design.
  If interception fails (non-standard send handling), the extension falls back to after-send mode.
- Context is delivered via the visible composer (not invisible injection) — intentional and honest.
- While a memory request is open, pressing Enter again shows "still handling your previous request".
- Session grants ("This session") reset when the service worker restarts (browser restart).
- Retrieval is keyword overlap + category hints; no semantic understanding.
- No cross-device sync, no encryption-at-rest beyond Chrome's profile storage, no Gemini.

## Three decisions to make next

1. **Context delivery mechanism** — keep visible composer injection (transparent, robust, but
   pollutes the message) vs. clipboard/overlay hand-off vs. pursuing deeper editor integration.
   This defines the product's honesty/UX trade-off.
2. **Retrieval v1** — move to local embeddings (e.g., Transformers.js/WebGPU, still on-device) while
   keeping the `retrieveRelevantMemories()` contract, or invest in LLM-assisted relevance only at
   request time. Decide privacy budget first.
3. **Permission granularity** — is (app × profile) the right unit, or do users need field-level /
   memory-level allowlists, time-boxed grants, and a proper "session" that survives service-worker
   eviction? This shapes the whole authorization layer.
