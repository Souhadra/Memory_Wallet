# Privacy Policy — Memory Wallet

**Last updated:** August 31, 2026
**Applies to:** Memory Wallet Chrome extension v1.0.0 (and later), distributed via the Chrome Web Store and via GitHub.

Memory Wallet is **local-first by design**. We do not operate a backend, we do not create accounts, and we do not collect analytics.

## Summary

- All your memories, profiles, permissions, and request logs are stored **only on your device** in `chrome.storage.local` and `IndexedDB`.
- Nothing is uploaded to our servers — because there are no servers.
- The only network request the extension ever makes is a **one-time download of an open-source AI model** from Hugging Face (see below). No personal data is sent with that request.
- The code is open source: https://github.com/Souhadra/Memory_Wallet

## Data we store (on-device only)

| Data | Where | Purpose |
|------|-------|---------|
| Profiles (name, icon, description) | `chrome.storage.local` (`mw_profiles`) | Context boundaries you create |
| Memories (content, category, importance) | `chrome.storage.local` (`mw_memories`) + vectors in `IndexedDB` (`memory-wallet-embeddings`) | Matched locally to answer your questions |
| Permissions (AI app × profile → allow/deny/ask) | `chrome.storage.local` (`mw_permissions`) | Enforce your sharing rules |
| Request log (query, categories, matched IDs, status) | `chrome.storage.local` (`mw_requests`, last 100) | Audit trail — memory content itself is not duplicated in the log |
| Settings | `chrome.storage.local` (`mw_settings`) | Your preferences |

All keys are prefixed `mw_`. Uninstalling the extension deletes `chrome.storage.local`. You can also wipe everything via **Dashboard → Settings → Factory reset** (also clears `IndexedDB` vectors).

## Network access

### 1. AI sites you use
The extension injects a content script into `https://chatgpt.com/*` and `https://claude.ai/*` (declared in `host_permissions`) to detect when you press Enter/click Send and to show the permission card. It does not read your browsing history and does not contact any other site.

### 2. One-time model download (remote data, not remote code)
To match memories by meaning (not just keywords), Memory Wallet can download the open-source embedding model **Xenova/all-MiniLM-L6-v2** (~30 MB) from `huggingface.co` via the `Transformers.js` library. This happens once, is cached by the browser, and works offline afterwards.

- No query, memory, or personal data is sent to Hugging Face.
- The request is a standard `fetch` for model weights (data), not executable code. The extension's `content_security_policy` (`script-src 'self'`) blocks remote code execution.
- You can disable semantic matching entirely in **Dashboard → Settings → Semantic search** — the extension then uses only keyword matching and never fetches the model.

No other network requests are made.

## Permissions — why each is needed (Chrome Web Store Data Use Disclosure)

| Permission | Why |
|------------|-----|
| `storage` | Persist profiles, memories, permissions, and settings on-device |
| `scripting` | Inject `content/content.js` into ChatGPT/Claude tabs and auto-inject into already-open AI tabs after install |
| `offscreen` | Run the local embedding model in an offscreen document (`offscreen/offscreen.html`) — required by Chrome for `Transformers.js` + `onnxruntime-web` WASM |
| `host_permissions: https://chatgpt.com/*, https://claude.ai/*` | Detect send actions and show the permission modal on the two supported AI sites |

The extension does **not** request `tabs`, `<all_urls>`, `cookies`, `history`, or any broad host access.

## Data sharing

We do not sell, share, or transmit your data to any third party. The only external fetch (model weights) carries no personal data.

## Your controls

- **Export:** Dashboard → Requests → Copy context; or copy memories from the Memories tab.
- **Delete per-item:** Delete any memory or profile from the dashboard (vectors are also removed).
- **Wipe all:** Settings → Factory reset.
- **Revoke access:** Dashboard → Permissions → set any (AI app × profile) to Deny; or Deny a single request in the card (one-off).

## Children's privacy

The extension is not directed to children under 13 and does not knowingly collect data from them.

## Changes to this policy

We will update this file and the version date above for material changes. The extension is open source — diffs are visible on GitHub.

## Contact

Open an issue at https://github.com/Souhadra/Memory_Wallet/issues
