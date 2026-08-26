import { useEffect, useMemo, useState } from "react";
import { useWalletState } from "../ui/hooks";
import { memoryCountFor, relativeTime } from "../ui/format";
import { loadDemoData, reopenOnboarding, setActiveProfile } from "../shared/actions";
import { IconLock, IconSliders } from "../ui/icons";
import type { RequestStatus } from "../shared/types";

const STATUS_META: Record<RequestStatus, { label: string; cls: string }> = {
  approved: { label: "Allowed", cls: "chip chip-allow" },
  denied: { label: "Denied", cls: "chip chip-deny" },
  pending: { label: "Pending", cls: "chip chip-pending" },
};

export function App() {
  const state = useWalletState();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [bgOk, setBgOk] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "PING" })
      .then((res) => setBgOk(Boolean(res?.ok)))
      .catch(() => setBgOk(false));
  }, []);

  const recent = useMemo(
    () =>
      (state?.requests ?? [])
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3),
    [state],
  );

  if (!state) {
    return <div className="popup loading">Loading…</div>;
  }

  const activeProfileId = state.settings.activeProfileId;
  const walletEmpty = state.memories.length === 0;

  async function handleLoadDemo() {
    setLoadingDemo(true);
    await loadDemoData();
    setLoadingDemo(false);
  }

  function openSettings() {
    void chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#settings") });
  }

  async function handleGetStarted() {
    await reopenOnboarding();
    chrome.runtime.openOptionsPage();
  }

  return (
    <div className="popup">
      <header className="header">
        <div className="brand">
          <span className="brand-icon"><IconLock size={24} /></span>
          <div>
            <h1>Memory Wallet</h1>
            <p>Your AI memory. Your rules.</p>
          </div>
        </div>
        <div className="status" title={bgOk ? "Wallet background running" : "Background not responding — reload the extension"}>
          <span className={`status-dot ${bgOk === true ? "ok" : bgOk === false ? "bad" : ""}`} />
          <span className="status-label">{bgOk === false ? "Offline" : "Active"}</span>
        </div>
      </header>

      {walletEmpty ? (
        <section className="empty">
          <p className="empty-title">Set up your wallet</p>
          <p className="muted small center">
            Import your ChatGPT memory JSON or load sample data to start sharing context with AI apps.
          </p>
          <button className="btn btn-primary" onClick={() => void handleGetStarted()}>
            Get started
          </button>
          <button className="btn" onClick={() => void handleLoadDemo()} disabled={loadingDemo}>
            {loadingDemo ? "Loading…" : "Load sample data"}
          </button>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <h2>Profiles</h2>
              <span className="muted">{state.memories.length} memories</span>
            </div>
            <ul className="profile-list">
              {state.profiles.map((p) => {
                const count = memoryCountFor(state, p.id);
                const isActive = p.id === activeProfileId;
                return (
                  <li key={p.id}>
                    <button
                      className={`profile-row ${isActive ? "active" : ""}`}
                      onClick={() => void setActiveProfile(p.id)}
                      title={isActive ? "Active profile" : "Make active profile"}
                    >
                      <span className="profile-icon">{p.icon}</span>
                      <span className="profile-name">{p.name}</span>
                      {isActive && <span className="active-dot">●</span>}
                      <span className="profile-count">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Recent Requests</h2>
              <span className="muted">last {recent.length}</span>
            </div>
            {recent.length === 0 ? (
              <p className="muted empty-line">
                No requests yet. Ask a question on ChatGPT or Claude.
              </p>
            ) : (
              <ul className="request-list">
                {recent.map((r) => {
                  const app = state.aiApplications.find((a) => a.id === r.aiApplicationId);
                  const profile = state.profiles.find((p) => p.id === r.profileId);
                  const meta = STATUS_META[r.status];
                  return (
                    <li key={r.id} className="request-row">
                      <div className="request-main">
                        <span className="request-app">{app?.name ?? r.aiApplicationId}</span>
                        <span className="request-sub">
                          {profile?.icon} {profile?.name} · {relativeTime(r.createdAt)}
                        </span>
                      </div>
                      <span className={meta.cls}>{meta.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="footer">
            <button className="btn btn-primary" onClick={() => chrome.runtime.openOptionsPage()}>
              Open Wallet
            </button>
            <button className="btn btn-icon" title="Settings" aria-label="Settings" onClick={openSettings}>
              <IconSliders size={15} />
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
