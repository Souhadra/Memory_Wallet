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
│   ├── offscreen/             # hidden page that hosts the local embedding model
│   │   ├── offscreen.html
│   │   └── offscreen.ts       # Transformers.js — all-MiniLM-L6-v2, on-device
│   ├── shared/                # code shared by background, content, popup, options
│   │   ├── types.ts           # Profile / Memory / … + MemorySource + Settings
│   │   ├── constants.ts       # storage keys, categories, synonym map, priority
│   │   ├── storage.ts         # chrome.storage.local repos
│   │   ├── retrieval.ts       # hybrid: keyword → semantic → general fallback
│   │   ├── vectorStore.ts     # IndexedDB vector store for semantic search
│   │   ├── contextBlock.ts    # builds [Memory Wallet Context] (Matched/Semantic/General)
│   │   ├── permissions.ts     # get/set per (AI app × profile) access level
│   │   ├── actions.ts         # CRUD + nested-JSON import
│   │   ├── messages.ts        # runtime message contracts (incl. EMBED_MSG)
│   │   └── demoData.ts        # demo profiles + memories
│   ├── providers/             # AIProviderAdapter abstraction
│   │   ├── types.ts           # adapter interface
│   │   ├── chatgpt.ts
│   │   ├── claude.ts
│   │   └── registry.ts
│   ├── background/
│   │   ├── index.ts           # service worker entry
│   │   ├── orchestrator.ts    # permission resolution, request lifecycle, logging
│   │   └── embeddingService.ts# offscreen lifecycle, index upkeep, status
│   ├── content/
│   │   ├── index.ts           # wires detector + modal + injector per provider
│   │   ├── detector.ts        # send interception + bubble fallback
│   │   ├── injector.ts        # fills composer, retries, clipboard fallback
│   │   └── ui/
│   │       ├── modal.ts       # Shadow-DOM modal (profile chips, live preview)
│   │       └── toast.ts       # toasts + pill
│   ├── ui/                    # shared React hooks + formatting helpers
│   ├── popup/                 # extension popup (React)
│   └── options/               # full dashboard (React)
└── dist/                      # build output → load this folder as an unpacked extension
└── import-files/              # gitignored — your 47 LIBRO memories split by profile (npm run split-memory)
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
| Two stacked cards / deny acted twice (pre-v0.4) | Double content-script injection; fixed via the `__memoryWalletLoaded` guard — update and reload tabs. |
| Deny/Allow loops back to a new card (pre-v0.4.1) | Our own programmatic re-send was being intercepted; fixed via the `isTrusted` event guard. |
| Card taller than the screen / Allow cut off (pre-v0.5.1) | The card now scrolls internally with Deny/Allow pinned; durations compacted to one row, previews clamp to 2 lines. |
| Semantic status shows "downloading" forever | One-time ~30MB model download from Hugging Face — needs internet once, cached afterwards; check the offscreen console for errors. |
| `SyntaxError: Cannot use 'import.meta' outside a module` (pre-v0.6.1) | Offscreen script was loaded as a classic script; now loaded as a module — update and reload. |

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

**Option A — quick demo (generic data):**
Click the Memory Wallet icon → **Load sample data** in the empty-state (or **Get started** → wizard → sample data) → Startup / Work / Personal appear; Startup becomes active.

**Option B — your real LIBRO data (47 memories):**
Dashboard → **Memories** → *Import ChatGPT memory JSON* → import `import-files/startup.json` → Startup (24), `work.json` → Work (17), `personal.json` → Personal (6). Or import `chatgpt-memories.json` whole into any profile. Regenerate splits anytime via `npm run split-memory`.

Then run the 16 steps:

1. Open Memory Wallet (extension icon → green ● = background running).
2. Confirm **🚀 Startup** profile is active (click it in the popup if not).
3. Dashboard → **Memories** → filter Startup → see your LIBRO / Memory Wallet memories (24 in Startup).
4. Open https://chatgpt.com → new chat. Type: *"I'm working on my library chatbot LIBRO — what architecture should I use?"*
5. Press **Enter** — message is paused, 🔐 **Memory Request** appears instantly: profile Startup, categories, reason, READ ONLY, **preview of 3 memories that will be shared** (e.g., `Library Chatbot › Architecture — Vectorless RAG…`), duration.
6. Choose **Once** → **Allow** → composer fills with `[Memory Wallet Context]` (previewed memories) + your question and submits as ONE message. ChatGPT answers with your context.
7. **Wrong profile?** While the card is open, tap another profile chip (e.g. 💼 Work) — the "will share" list swaps instantly. Allow shares from that profile; "Always allow" then targets it.
8. **Deny test**: ask again → **Deny** (or ✕) → your exact question sends once, unchanged, no context, no lingering card.
9. **Unrelated-question test** ("Should I do Masters?"): the card shows **"No direct match — sharing N general memories from this profile"** with your education/career entries dimmed and tagged *general* → **Allow** → those flow in as a `General context:` section, so the AI can advise using your real background. **Deny** → sends once, no new card.
10. Fallback is a setting: dashboard → Settings → "When nothing matches, share top general memories" — turn it OFF to return to share-nothing behavior.
11. Switch to https://claude.ai → ask: *"How should I price and deploy LIBRO for engineering colleges?"*
12. **Claude triggers its own Memory Request** → see profile, categories, reason, previewed memories, READ ONLY, duration.
13. **Allow** → same injection flow → context appears in Claude's composer before sending.
14. Verify retrieval & audit: dashboard → **Requests** → latest entries show which profile was used; click **View** for full query/reason/shared memories; **Copy context** copies the exact block.
15. Confirm **Claude answers using that context** (mentions Vectorless RAG, Render, white-label etc. from your memories).
16. **Revoke**: dashboard → **Permissions** → set Claude × Startup to **Deny** → next Claude question sends immediately with no card (logged as Denied).

## What works

- **Designed UI (v0.8)**: shared design tokens, thin-line SVG icon set replacing UI emoji,
  consistent focus rings/hover states across popup + dashboard + on-page permission card
  (profile emoji like 🚀 stay — they're user data)
- **Visual harness**: after building, open `dist/test/ui.html` in a browser — renders the real
  dashboard and popup (`?view=popup`) against a stubbed store; no extension reload needed
- **First-run wizard**: fresh wallet opens a 3-step setup — import your real ChatGPT memory JSON
  (or load sample data, or start empty) → pick the active profile → try-it-live instructions.
  Skippable; reopenable via Settings → "Run setup again" (data untouched).
- **Intercept-at-send flow**: pause message → permission card → allow → context + question sent
  together; deny/timeout → original question sent unchanged (exactly once)
- **Preview before you allow + switch profile in-card**: modal shows the top 3 memories per profile
  so you can tap a different profile chip and see what *would* be shared before deciding; Allow
  uses the selected profile (including session/always grants); Deny is one-off
- **General-context fallback**: when direct + semantic matching finds no match, requests fill with the profile's strongest memories, labeled honestly — toggleable in Settings
- **Semantic matching (on-device)**: local embeddings (Transformers.js, all-MiniLM-L6-v2, ~30MB one-time download, cached) as Tier 2 between keyword hits and general fill — toggleable, degrades silently when unavailable; status + controls in Settings
- Profiles + manual memory CRUD (create/rename/delete profile; add/edit/delete memory)
- **Import of real ChatGPT memory JSON** into any profile (nested-profile flattener, dedupe,
  category inference) + pre-split `import-files/` for your 47 LIBRO memories
- Active-profile switching in the popup (wallet metaphor) + on-page pill shows the active profile, live
- **Popup declutter**: Open Wallet + settings only; sample data offered exclusively while the wallet
  is empty — demo memories can never mix with real ones
- Site detection + send interception for ChatGPT & Claude via provider adapters, with mutation-
  observer fallback and an on-site 🔐 pill for manual re-triggering
- Auto-injection of the content script into already-open AI tabs after install/reload
- Specific permission modal (who / which profile / what info / why / preview / READ ONLY / duration)
- ASK / ALLOW / DENY per (AI app × profile) + ALLOW ONCE + session grants
- Keyword/synonym + semantic + general hybrid scoring (`retrieveRelevantMemories`) returning top-N matches; all tiers local
- **Request audit log with View + Copy context** — expand any request to see full query, reason, shared memories and copy the exact `[Memory Wallet Context]` block
- Revoke controls, factory reset, local-only mode (always on), demo data marked as `[demo]`

## Known limitations

- **DOM selectors and send interception are fragile** — ChatGPT/Claude markup changes can break
  detection, injection or send-pausing; everything lives in one small file per provider by design.
  If interception fails (non-standard send handling), the extension falls back to after-send mode.
- Context is delivered via the visible composer (not invisible injection) — intentional and honest.
- While a memory request is open, pressing Enter again shows "still handling your previous request".
- Session grants ("This session") reset when the service worker restarts (browser restart).
- Retrieval is hybrid (keyword/synonym → semantic embedding → importance-ranked general fallback), all on-device; needs a one-time ~30MB model download, then works offline.
- No cross-device sync, no encryption-at-rest beyond Chrome's profile storage, no Gemini.

## Three decisions to make next

1. **Context delivery mechanism** — keep visible composer injection (transparent, robust, but
   pollutes the message) vs. clipboard/overlay hand-off vs. pursuing deeper editor integration.
   This defines the product's honesty/UX trade-off.
2. **Semantic quality vs cost** — the local hybrid is now live; next lever is tuning the semantic threshold / fusion order, or trying a larger model vs. keeping the 30MB one for speed.
3. **Permission granularity** — is (app × profile) the right unit, or do users need field-level /
   memory-level allowlists, time-boxed grants, and a proper "session" that survives service-worker
   eviction? This shapes the whole authorization layer.


