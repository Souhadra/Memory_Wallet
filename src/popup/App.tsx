import { useEffect, useMemo, useState } from "react";
import { useWalletState } from "../ui/hooks";
import { memoryCountFor, relativeTime } from "../ui/format";
import { loadDemoData, setActiveProfile } from "../shared/actions";
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

  async function handleLoadDemo() {
    setLoadingDemo(true);
    await loadDemoData();
    setLoadingDemo(false);
  }

  return (
    <div className="popup">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">🔐</span>
          <div>
            <h1>Memory Wallet</h1>
            <p>Your AI memory. Your rules.</p>
          </div>
        </div>
        <div
          className={`status-dot ${bgOk === true ? "ok" : bgOk === false ? "bad" : ""}`}
          title={bgOk ? "Wallet background running" : "Background not responding — reload the extension"}
        >
          {bgOk === true ? "●" : bgOk === false ? "○" : "◌"}
        </div>
      </header>

      {state.profiles.length === 0 ? (
        <section className="empty">
          <p>No profiles yet.</p>
          <button className="btn btn-primary" onClick={handleLoadDemo} disabled={loadingDemo}>
            {loadingDemo ? "Loading…" : "Load Demo Data"}
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
            <button className="btn" onClick={handleLoadDemo} disabled={loadingDemo}>
              {loadingDemo ? "Loading…" : "Load Demo Data"}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
