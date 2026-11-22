/**
 * Offscreen document: hosts the local embedding model.
 *
 * Lives as a hidden extension page (created via chrome.offscreen by the
 * background worker) because MV3 service workers have no DOM and die when
 * idle — bad hosts for a neural net.
 *
 * The model ships inside the extension package (see scripts/fetch-model.mjs)
 * and remote loading is disabled below, so this document never makes a network
 * request: "nothing leaves your device" is enforced by configuration, not copy.
 */
import { pipeline, env } from "@huggingface/transformers";
import { EMBED_MSG } from "../shared/messages";

// Serve the onnxruntime wasm binaries from the extension itself.
(env as unknown as { backends: { onnx: { wasm: { wasmPaths: string; numThreads: number } } } }).backends.onnx.wasm.wasmPaths =
  chrome.runtime.getURL("offscreen/wasm/");
(env as unknown as { backends: { onnx: { wasm: { wasmPaths: string; numThreads: number } } } }).backends.onnx.wasm.numThreads = 1; // no cross-origin isolation in extension pages

// Bundled model only. All three flags matter:
//   allowRemoteModels=false  → never fall back to huggingface.co
//   allowLocalModels=true    → resolve files from localModelPath below
//   useBrowserCache=false    → nothing is fetched, so nothing needs caching
(env as unknown as { allowRemoteModels: boolean }).allowRemoteModels = false;
(env as unknown as { allowLocalModels: boolean }).allowLocalModels = true;
(env as unknown as { localModelPath: string }).localModelPath =
  chrome.runtime.getURL("offscreen/models/");
(env as unknown as { useBrowserCache: boolean }).useBrowserCache = false;

/** Directory name under offscreen/models/ — NOT a hub model id. */
const LOCAL_MODEL = "all-MiniLM-L6-v2";

type Extractor = Awaited<ReturnType<typeof pipeline>>;
let extractor: Extractor | null = null;
let loading: Promise<Extractor> | null = null;

function reportStatus(patch: Record<string, unknown>): void {
  void chrome.storage.local.get("mw_embed_status").then((res) => {
    const cur = res["mw_embed_status"] ?? {};
    void chrome.storage.local.set({ mw_embed_status: { ...cur, ...patch } });
  });
}

async function getExtractor(): Promise<Extractor> {
  if (extractor) return extractor;
  if (!loading) {
    loading = (pipeline as unknown as (task: string, model: string, opts: unknown) => Promise<Extractor>)(
      "feature-extraction",
      LOCAL_MODEL,
      { dtype: "q8" },
    )
      .then((pipe) => {
        extractor = pipe;
        loading = null;
        return pipe;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

async function embed(texts: string[]): Promise<number[][]> {
  const pipe = await getExtractor();
  const output = await (pipe as unknown as (texts: string[], opts: unknown) => Promise<{ tolist(): number[][] }>)(
    texts,
    { pooling: "mean", normalize: true },
  );
  // Tensor shape: [batch, dim] after pooling.
  return output.tolist();
}

// Start loading the model as soon as this page exists instead of on the first embed request.
// Waiting for a message made the first question after every browser start pay the whole load,
// and the background's startup warm-up message can arrive before this listener is registered.
void getExtractor().catch(() => undefined);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === EMBED_MSG.EMBED_QUERY) {
    const reqId = (message as { reqId?: number }).reqId;
    // Two callers need the result: the direct sender reads sendResponse, while
    // the background indexer waits for a broadcast EMBED_RESULT. Sending only
    // the response left indexing waiting forever and timing out at 30s.
    const reply = (payload: { ok: boolean; vectors?: number[][]; error?: string }) => {
      sendResponse(payload);
      if (typeof reqId === "number") {
        void chrome.runtime
          .sendMessage({ type: EMBED_MSG.EMBED_RESULT, reqId, ...payload })
          .catch(() => undefined);
      }
    };
    embed(message.texts as string[])
      .then((vectors) => reply({ ok: true, vectors }))
      .catch((err) => reply({ ok: false, error: String(err) }));
    return true; // async response
  }

  if (message?.type === EMBED_MSG.CLEAR_MODEL_CACHE) {
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => /transformers|onnx|huggingface/i.test(k))
            .map((k) => caches.delete(k)),
        );
        extractor = null;
        loading = null;
        reportStatus({ state: "idle" });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  return false;
});

console.info("[Memory Wallet] offscreen embedding host loaded");
