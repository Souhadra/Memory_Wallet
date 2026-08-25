/**
 * Offscreen document: hosts the local embedding model.
 *
 * Lives as a hidden extension page (created via chrome.offscreen by the
 * background worker) because MV3 service workers have no DOM and die when
 * idle — bad hosts for a 30MB neural net. Everything here runs on-device;
 * the only network access ever is the ONE-TIME model download from
 * huggingface.co, cached by the browser afterwards.
 */
import { pipeline, env } from "@huggingface/transformers";
import { EMBED_MSG } from "../shared/messages";

// Serve the onnxruntime wasm binaries from the extension itself.
(env as unknown as { backends: { onnx: { wasm: { wasmPaths: string; numThreads: number } } } }).backends.onnx.wasm.wasmPaths =
  chrome.runtime.getURL("offscreen/wasm/");
(env as unknown as { backends: { onnx: { wasm: { wasmPaths: string; numThreads: number } } } }).backends.onnx.wasm.numThreads = 1; // no cross-origin isolation in extension pages
(env as unknown as { allowLocalModels: boolean }).allowLocalModels = false;
(env as unknown as { useBrowserCache: boolean }).useBrowserCache = true; // one-time model download, cached afterwards

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
      "Xenova/all-MiniLM-L6-v2",
      {
        dtype: "q8",
        progress_callback: (p: { status?: string; loaded?: number; total?: number }) => {
          if (p?.status === "progress" && (p.total ?? 0) > 0) {
            reportStatus({
              state: "downloading",
              pct: Math.min(99, Math.round(((p.loaded ?? 0) / (p.total ?? 1)) * 100)),
            });
          }
        },
      },
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === EMBED_MSG.EMBED_QUERY) {
    embed(message.texts as string[])
      .then((vectors) => sendResponse({ ok: true, vectors }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
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
        reportStatus({ state: "idle", pct: undefined });
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
