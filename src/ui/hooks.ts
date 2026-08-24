import { useEffect, useState } from "react";
import type { WalletState } from "../shared/types";
import { getState } from "../shared/storage";

export function useWalletState(): WalletState | null {
  const [state, setState] = useState<WalletState | null>(null);

  useEffect(() => {
    let mounted = true;
    void getState().then((s) => {
      if (mounted) setState(s);
    });
    const listener = () => {
      void getState().then((s) => {
        if (mounted) setState(s);
      });
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  return state;
}
