import { useEffect, useState } from "react";
import { useWalletState } from "../ui/hooks";
import { Card, SectionTitle, Toggle } from "./components";
import { relativeTime } from "../ui/format";
import { EMBED_MSG } from "../shared/messages";

type SectionId =
  | "overview"
  | "profiles"
  | "memories"
  | "apps"
  | "permissions"
  | "requests"
  | "settings";

const NAV: { id: SectionId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◎" },
  { id: "profiles", label: "Profiles", icon: "🗂" },
  { id: "memories", label: "Memories", icon: "🧠" },
  { id: "apps", label: "AI Apps", icon: "🤖" },
  { id: "permissions", label: "Permissions", icon: "🛡" },
  { id: "requests", label: "Requests", icon: "📨" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export function App() {
  const state = useWalletState();
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const [section, setSection] = useState<SectionId>(() => {
    const h = window.location.hash.replace("#", "");
    return NAV.some((n) => n.id === h) ? (h as SectionId) : "overview";
  });

  const showWizard =
    !!state && (forceOnboarding || (!state.settings.onboardingDone && state.memories.length === 0));

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🔐</span>
          <div>
            <h1>Memory Wallet</h1>
            <p>Your AI memory. Your rules.</p>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${section === n.id ? "active" : ""}`}
              onClick={() => setSection(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">Local-only prototype · v0.7.0</div>
      </aside>

      <main className="content">
        {!state ? (
          <p className="empty-hint">Loading…</p>
        ) : showWizard ? (
          <Onboarding
            onDone={() => {
              setForceOnboarding(false);
              setSection("overview");
            }}
          />
        ) : (
          <>
            {section === "overview" && <Overview />}
            {section === "profiles" && <Profiles />}
            {section === "memories" && <Memories />}
            {section === "apps" && <AIApps />}
            {section === "permissions" && <Permissions />}
            {section === "requests" && <Requests />}
            {section === "settings" && <Settings onRunSetup={() => setForceOnboarding(true)} />}
          </>
        )}
      </main>
    </div>
  );
}

function Overview() {
  const state = useWalletState();
  if (!state) return null;
  const recent = state.requests.slice(0, 6);

  return (
    <>
      <SectionTitle
        title="Overview"
        subtitle="A snapshot of your wallet. Everything is stored locally on this device."
      />
      <div className="stats">
        <Card className="stat">
          <span className="stat-value">{state.memories.length}</span>
          <span className="stat-label">Total memories</span>
        </Card>
        <Card className="stat">
          <span className="stat-value">{state.profiles.length}</span>
          <span className="stat-label">Profiles</span>
        </Card>
        <Card className="stat">
          <span className="stat-value">{state.aiApplications.length}</span>
          <span className="stat-label">Connected AI apps</span>
        </Card>
        <Card className="stat">
          <span className="stat-value">{state.requests.filter((r) => r.status === "approved").length}</span>
          <span className="stat-label">Approved requests</span>
        </Card>
      </div>

      <h2 className="sub-head">Recent access requests</h2>
      <Card>
        {recent.length === 0 ? (
          <p className="empty-hint">No access requests yet.</p>
        ) : (
          <ul className="rows">
            {recent.map((r) => {
              const app = state.aiApplications.find((a) => a.id === r.aiApplicationId);
              const profile = state.profiles.find((p) => p.id === r.profileId);
              return (
                <li key={r.id} className="row">
                  <span className="row-title">{app?.name ?? r.aiApplicationId} → {profile?.name ?? "?"}</span>
                  <span className="muted">{relativeTime(r.createdAt)}</span>
                  <StatusChip status={r.status} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

export function StatusChip({ status }: { status: "approved" | "denied" | "pending" }) {
  const map = {
    approved: { label: "Allowed", cls: "chip-allow" },
    denied: { label: "Denied", cls: "chip-deny" },
    pending: { label: "Pending", cls: "chip-pending" },
  } as const;
  const meta = map[status];
  return <span className={`chip ${meta.cls}`}>{meta.label}</span>;
}

/* ------------------------------------------------------------------ */
/* First-run wizard                                                    */
/* ------------------------------------------------------------------ */

function Onboarding({ onDone }: { onDone: () => void }) {
  const state = useWalletState();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [targetProfileId, setTargetProfileId] = useState("__new");
  const [newProfileName, setNewProfileName] = useState("Personal");
  const [pickedProfile, setPickedProfile] = useState("");

  if (!state) return null;
  const profiles = state.profiles;

  async function finish(): Promise<void> {
    const { saveSettings } = await import("../shared/storage");
    await saveSettings({ onboardingDone: true });
    onDone();
  }

  async function handleImportFile(file: File): Promise<void> {
    setBusy(true);
    setMsg("");
    try {
      const actions = await import("../shared/actions");
      const parsed = actions.parseMemoryJson(await file.text());
      if (parsed.length === 0) {
        setMsg("Could not find any memories in that file.");
        return;
      }
      let profileId = targetProfileId;
      if (profileId === "__new") {
        const name = newProfileName.trim() || "Personal";
        const existing = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
        profileId = existing ? existing.id : (await actions.createProfile(name)).id;
      }
      const res = await actions.importMemoriesIntoProfile(profileId, parsed);
      setMsg(`Imported ${res.imported} memories into ${profiles.find((p) => p.id === profileId)?.name ?? "profile"}.`);
      setStep(1);
    } finally {
      setBusy(false);
    }
  }

  async function handleSample(): Promise<void> {
    setBusy(true);
    const actions = await import("../shared/actions");
    await actions.loadDemoData();
    setBusy(false);
    setStep(1);
  }

  async function handleContinue(): Promise<void> {
    const id =
      pickedProfile || state?.settings.activeProfileId || profiles[0]?.id;
    if (id) {
      const { setActiveProfile } = await import("../shared/actions");
      await setActiveProfile(id);
    }
    setStep(2);
  }

  return (
    <div className="wizard">
      <header className="wizard-head">
        <h1>🔐 Welcome to Memory Wallet</h1>
        <p>Your AI memory. Your rules. Three quick steps and you're live.</p>
      </header>

      <ol className="wizard-steps">
        {["Your memories", "Active profile", "Try it live"].map((label, i) => (
          <li key={label} className={i === step ? "current" : i < step ? "done" : ""}>
            <span className="step-num">{i < step ? "✓" : i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="wizard-options">
          <div className="wizard-option">
            <div className="wizard-option-head">
              <strong>Import my ChatGPT memory JSON</strong>
              <span className="pill">Recommended</span>
            </div>
            <p className="muted small">
              Works with the Manage-memories list or a data export. Nested profile exports are
              flattened automatically. Parsed and stored locally.
            </p>
            <div className="form-row">
              <select value={targetProfileId} onChange={(e) => setTargetProfileId(e.target.value)}>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
                <option value="__new">New profile…</option>
              </select>
              {targetProfileId === "__new" && (
                <input
                  placeholder="Profile name"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
              )}
              <label className="btn btn-primary file-btn">
                {busy ? "Importing…" : "Choose file"}
                <input
                  type="file"
                  accept=".json,application/json,.txt"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportFile(f);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="wizard-option">
            <div className="wizard-option-head">
              <strong>Load sample data</strong>
              <span className="muted small">quick demo</span>
            </div>
            <p className="muted small">
              Creates clearly-marked Startup / Work / Personal profiles with a few sample memories.
            </p>
            <button className="btn" disabled={busy} onClick={() => void handleSample()}>
              Load sample data
            </button>
          </div>

          <div className="wizard-option">
            <div className="wizard-option-head">
              <strong>Start empty</strong>
            </div>
            <p className="muted small">Add memories yourself later in the Memories tab.</p>
            <button className="btn" onClick={() => setStep(1)}>
              Continue empty
            </button>
          </div>

          {msg && <p className="muted small">{msg}</p>}
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <p className="muted small">
            Which profile should AI apps read from by default? You can switch anytime in the popup.
          </p>
          <div className="wizard-profiles">
            {profiles.map((p) => {
              const count = state.memories.filter((m) => m.profileId === p.id).length;
              const isActive = state.settings.activeProfileId === p.id;
              const selected = pickedProfile ? pickedProfile === p.id : isActive;
              return (
                <button
                  key={p.id}
                  className={`wizard-profile-card ${selected ? "selected" : ""}`}
                  onClick={() => setPickedProfile(p.id)}
                >
                  <span className="profile-big">{p.icon}</span>
                  <span className="wizard-profile-meta">
                    <strong>{p.name}</strong>
                    <span className="muted small">{count} memories</span>
                  </span>
                  {selected && <span className="pill">Active</span>}
                </button>
              );
            })}
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => void handleContinue()}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <Card>
          <h3 className="card-title">You're live 🎉</h3>
          <ol className="wizard-try">
            <li>Open ChatGPT (or Claude) and start a new chat.</li>
            <li>
              Ask something your memories can answer — e.g.{" "}
              <em>"What architecture should I use for my library chatbot?"</em>
            </li>
            <li>Your message pauses and a 🔐 Memory Request card appears. Pick Once → Allow.</li>
            <li>The context block + your question are sent together — the answer uses your memory.</li>
          </ol>
          <div className="btn-row">
            <button
              className="btn btn-primary"
              onClick={() => chrome.tabs.create({ url: "https://chatgpt.com" })}
            >
              Open ChatGPT ↗
            </button>
            <button className="btn" onClick={() => void finish()}>
              Finish
            </button>
          </div>
        </Card>
      )}

      <footer className="wizard-footer">
        <button className="btn small" onClick={() => void finish()}>
          Skip setup
        </button>
      </footer>
    </div>
  );
}

function Profiles() {
  return (
    <>
      <SectionTitle
        title="Profiles"
        subtitle="Profiles are context boundaries. AI apps only ever see the profile they are granted."
      />
      <ProfilesSection />
    </>
  );
}

function ProfilesSection() {
  const state = useWalletState();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [selected, setSelected] = useState<string | null>(null);

  if (!state) return null;
  const selProfile = state.profiles.find((p) => p.id === selected);

  async function handleCreate() {
    if (!name.trim()) return;
    const { createProfile } = await import("../shared/actions");
    await createProfile(name, undefined, icon);
    setName("");
    setIcon("📁");
  }

  return (
    <div className="grid-two">
      <div className="stack">
        <Card>
          <h3 className="card-title">New profile</h3>
          <div className="form-row">
            <input
              placeholder="Icon (emoji)"
              value={icon}
              maxLength={4}
              onChange={(e) => setIcon(e.target.value)}
              style={{ width: 90 }}
            />
            <input
              placeholder="Profile name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            />
            <button className="btn btn-primary" onClick={() => void handleCreate()}>
              Create
            </button>
          </div>
        </Card>

        {state.profiles.map((p) => {
          const count = state.memories.filter((m) => m.profileId === p.id).length;
          const isActive = p.id === state.settings.activeProfileId;
          return (
            <Card key={p.id} className={isActive ? "card-accent" : ""}>
              <div className="profile-card-head">
                <span className="profile-big">{p.icon}</span>
                <div className="grow">
                  <strong>{p.name}</strong>
                  {isActive && <span className="pill">Active</span>}
                  <div className="muted small">{count} memories</div>
                </div>
              </div>
              {p.description && <p className="muted small desc">{p.description}</p>}
              <div className="btn-row">
                <button className="btn small" onClick={() => setSelected(p.id)}>View</button>
                <button
                  className="btn small"
                  onClick={() => {
                    const newName = window.prompt("Rename profile", p.name);
                    if (newName?.trim()) {
                      void import("../shared/actions").then((a) =>
                        a.updateProfile(p.id, { name: newName.trim(), icon: p.icon }),
                      );
                    }
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn small danger"
                  onClick={() => {
                    if (window.confirm(`Delete "${p.name}" and all of its memories?`)) {
                      void import("../shared/actions").then((a) => a.deleteProfile(p.id));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="stack">
        {selProfile ? (
          <Card>
            <h3 className="card-title">
              {selProfile.icon} {selProfile.name} — recent memories
            </h3>
            <ul className="rows">
              {state.memories
                .filter((m) => m.profileId === selProfile.id)
                .slice(0, 8)
                .map((m) => (
                  <li key={m.id} className="row">
                    <span className="row-title">{m.content}</span>
                    <span className="muted small">{m.category}</span>
                  </li>
                ))}
              {state.memories.filter((m) => m.profileId === selProfile.id).length === 0 && (
                <li className="empty-hint">No memories in this profile yet.</li>
              )}
            </ul>
            <p className="muted small">Permissions:</p>
            <ul className="rows">
              {state.aiApplications.map((app) => {
                const perm = state.permissions.find(
                  (x) => x.profileId === selProfile.id && x.aiApplicationId === app.id,
                );
                return (
                  <li key={app.id} className="row">
                    <span>{app.name}</span>
                    <span className="muted small">{perm ? perm.access.toUpperCase() : "ASK (default)"}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <Card><p className="empty-hint">Select a profile to view details.</p></Card>
        )}
      </div>
    </div>
  );
}

function Memories() {
  return (
    <>
      <SectionTitle
        title="Memories"
        subtitle="Add facts about yourself manually. Memories never leave this device unless you approve a request."
      />
      <MemoriesSection />
    </>
  );
}

function MemoriesSection() {
  const state = useWalletState();
  const [profileId, setProfileId] = useState("");
  const [category, setCategory] = useState("project");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(0.8);
  const [filterProfile, setFilterProfile] = useState("all");
  const [importTarget, setImportTarget] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");

  if (!state) return null;

  const effectiveProfileId = profileId || state.profiles[0]?.id || "";
  const shown = state.memories
    .filter((m) => filterProfile === "all" || m.profileId === filterProfile)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function handleSave() {
    if (!effectiveProfileId || !content.trim()) return;
    const actions = await import("../shared/actions");
    await actions.addMemory({
      profileId: effectiveProfileId,
      content,
      category: category as never,
      importance,
    });
    setContent("");
  }

  async function handleImport() {
    if (!importTarget) {
      setImportMsg("Pick a target profile first.");
      return;
    }
    let raw = importText.trim();
    // If a file was chosen, its content is already loaded into importText.
    if (!raw) {
      setImportMsg("Choose a .json file or paste JSON first.");
      return;
    }
    const actions = await import("../shared/actions");
    const parsed = actions.parseMemoryJson(raw);
    if (parsed.length === 0) {
      setImportMsg("Could not find any memories in that JSON.");
      return;
    }
    const result = await actions.importMemoriesIntoProfile(importTarget, parsed);
    setImportMsg(
      `Imported ${result.imported} of ${result.total} memories (${result.duplicates} already existed).`,
    );
    setImportText("");
    const fileInput = document.getElementById("mw-import-file") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
  }

  return (
    <div className="grid-two">
      <Card>
        <h3 className="card-title">Add Memory</h3>
        <label className="field">
          Profile
          <select value={effectiveProfileId} onChange={(e) => setProfileId(e.target.value)}>
            {state.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {["identity","preference","project","technical","work","personal","goal","other"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Memory
          <textarea
            rows={4}
            placeholder="I am building an AI Memory Wallet."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <label className="field">
          Importance: <strong>{importance.toFixed(1)}</strong>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={importance}
            onChange={(e) => setImportance(parseFloat(e.target.value))}
          />
        </label>
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={!effectiveProfileId}>
          Save Memory
        </button>

        <h3 className="card-title" style={{ marginTop: 22 }}>
          Import ChatGPT memory JSON
        </h3>
        <p className="muted small">
          Works with the memory list from ChatGPT Settings → Personalization → Memory → Manage, or a
          data-export <code>memories.json</code>. Memories stay on this device.
        </p>
        <label className="field">
          Target profile
          <select value={importTarget} onChange={(e) => setImportTarget(e.target.value)}>
            <option value="">Select profile…</option>
            {state.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          JSON file
          <input
            id="mw-import-file"
            type="file"
            accept=".json,application/json,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((t) => setImportText(t));
            }}
          />
        </label>
        <label className="field">
          …or paste JSON
          <textarea
            rows={3}
            placeholder='["Prefers concise answers", {"content": "Lives in Berlin"}]'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
        </label>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn btn-primary" onClick={() => void handleImport()}>
            Import
          </button>
          {importMsg && <span className="muted small">{importMsg}</span>}
        </div>
      </Card>

      <Card>
        <div className="form-row" style={{ marginBottom: 10 }}>
          <select value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)}>
            <option value="all">All profiles</option>
            {state.profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
            ))}
          </select>
          <span className="muted small">{shown.length} memories</span>
        </div>
        <ul className="rows">
          {shown.map((m) => {
            const p = state.profiles.find((x) => x.id === m.profileId);
            return (
              <li key={m.id} className="row memory-row">
                <div className="memory-main">
                  <span>{m.content}</span>
                  <span className="muted small">
                    {p?.icon} {p?.name} · {m.category} · importance {m.importance.toFixed(1)}
                  </span>
                </div>
                <button
                  className="btn small danger"
                  onClick={() => {
                    void import("../shared/actions").then((a) => a.deleteMemory(m.id));
                  }}
                >
                  ✕
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="empty-hint">No memories yet — add one or load demo data in Settings.</li>}
        </ul>
      </Card>
    </div>
  );
}

function AIApps() {
  return (
    <>
      <SectionTitle
        title="AI Apps"
        subtitle="Applications that can request context from your wallet. New providers can be added via provider adapters."
      />
      <AIAppsSection />
    </>
  );
}

function AIAppsSection() {
  const state = useWalletState();
  if (!state) return null;
  return (
    <div className="cards-grid">
      {state.aiApplications.map((app) => (
        <Card key={app.id}>
          <div className="profile-card-head">
            <span className="profile-big">{app.id === "claude" ? "🟠" : app.id === "chatgpt" ? "🟢" : "🤖"}</span>
            <div className="grow">
              <strong>{app.name}</strong>
              <div className="muted small">{app.domain}</div>
            </div>
            <span className="pill pill-green">Connected</span>
          </div>
          <p className="muted small">
            Permission default:{" "}
            {(() => {
              const anyPerm = state.permissions.some(
                (p) => p.aiApplicationId === app.id && p.access !== "ask",
              );
              return anyPerm ? "per-profile (see Permissions)" : "Ask on every request";
            })()}
          </p>
        </Card>
      ))}
    </div>
  );
}

function Permissions() {
  return (
    <>
      <SectionTitle
        title="Permissions"
        subtitle="Control which AI application may access which profile, and under what conditions."
      />
      <PermissionsSection />
    </>
  );
}

function PermissionsSection() {
  const state = useWalletState();
  if (!state) return null;

  async function setPerm(appId: string, profileId: string, access: string) {
    const { setAccessLevel } = await import("../shared/permissions");
    await setAccessLevel(appId, profileId, access as never);
  }

  return (
    <Card>
      <table className="perm-table">
        <thead>
          <tr>
            <th>AI App</th>
            {state.profiles.map((p) => (
              <th key={p.id}>{p.icon} {p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.aiApplications.map((app) => (
            <tr key={app.id}>
              <td><strong>{app.name}</strong></td>
              {state.profiles.map((p) => {
                const perm = state.permissions.find(
                  (x) => x.aiApplicationId === app.id && x.profileId === p.id,
                );
                const current = perm?.access ?? "ask";
                return (
                  <td key={p.id}>
                    <select
                      value={current}
                      onChange={(e) => void setPerm(app.id, p.id, e.target.value)}
                    >
                      <option value="ask">Ask</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        Ask → show permission modal · Allow → share relevant memories automatically · Deny → never
        share from that profile.
      </p>
    </Card>
  );
}

function Requests() {
  const state = useWalletState();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  if (!state) return null;
  const sorted = state.requests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function handleCopy(req: (typeof sorted)[number]) {
    const matched = state!.memories.filter((m) => req.matchedMemoryIds?.includes(m.id));
    if (matched.length === 0) return;
    const profile = state!.profiles.find((p) => p.id === req.profileId);
    const block = `[Memory Wallet Context]\nProfile: ${profile?.name ?? "Unknown"}\n${matched.map((m) => `- ${m.content}`).join("\n")}\n[End Memory Wallet Context]`;
    try {
      await navigator.clipboard.writeText(block);
      setCopied(req.id);
      setTimeout(() => setCopied((cur) => (cur === req.id ? null : cur)), 2000);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <>
      <SectionTitle
        title="Requests"
        subtitle="Full audit log of every memory access request. Memory content itself is never logged — only IDs."
      />
      <Card>
        {sorted.length === 0 ? (
          <p className="empty-hint">No requests logged yet.</p>
        ) : (
          <ul className="rows">
            {sorted.map((r) => {
              const app = state.aiApplications.find((a) => a.id === r.aiApplicationId);
              const profile = state.profiles.find((p) => p.id === r.profileId);
              const matched = state.memories.filter((m) => r.matchedMemoryIds?.includes(m.id));
              const isExpanded = expanded === r.id;
              return (
                <li
                  key={r.id}
                  className="row request-log-row"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="memory-main">
                      <span>
                        <strong>{app?.name ?? r.aiApplicationId}</strong> requested{" "}
                        <strong>{profile?.name ?? "?"}</strong>
                        {r.duration ? ` (${r.duration})` : ""}
                      </span>
                      <span className="muted small query-preview">“{r.query.slice(0, 120)}”</span>
                    </div>
                    <span className="muted small" style={{ whiteSpace: "nowrap" }}>
                      {relativeTime(r.createdAt)}
                    </span>
                    <StatusChip status={r.status} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="btn small" onClick={() => setExpanded(isExpanded ? null : r.id)}>
                      {isExpanded ? "Hide" : "View"}
                    </button>
                    {matched.length > 0 && (
                      <button className="btn small" onClick={() => void handleCopy(r)}>
                        {copied === r.id ? "Copied!" : `Copy context (${matched.length})`}
                      </button>
                    )}
                    <span className="muted small" style={{ marginLeft: "auto" }}>
                      {r.requestedCategories?.length ? r.requestedCategories.join(", ") : ""}
                    </span>
                  </div>
                  {isExpanded && (
                    <div
                      style={{
                        background: "#1d1d26",
                        border: "1px solid #2b2b36",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 12.5,
                        lineHeight: 1.5,
                      }}
                    >
                      <div>
                        <strong>Full query:</strong> <span className="muted">“{r.query}”</span>
                      </div>
                      <div>
                        <strong>Reason:</strong> <span className="muted">{r.reason}</span>
                      </div>
                      <div>
                        <strong>Requested categories:</strong>{" "}
                        <span className="muted">{r.requestedCategories?.join(", ") || "—"}</span>
                      </div>
                      {matched.length > 0 ? (
                        <div style={{ marginTop: 8 }}>
                          <strong>Shared memories ({matched.length}):</strong>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            {matched.map((m) => (
                              <li key={m.id} style={{ color: "#a1a1b5" }}>
                                {m.content} <span className="muted small">· {m.category}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="muted small" style={{ marginTop: 8 }}>
                          No memories were shared for this request.
                        </div>
                      )}
                      <div className="muted small" style={{ marginTop: 8 }}>
                        ID: {r.id} · {new Date(r.createdAt).toLocaleString()}
                        {r.resolvedAt ? ` → ${new Date(r.resolvedAt).toLocaleString()}` : ""}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

interface EmbedStatus {
  state?: "idle" | "downloading" | "ready" | "error";
  pct?: number;
  indexed?: number;
  total?: number;
  error?: string;
}

function SemanticSearchCard(props: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  const [status, setStatus] = useState<EmbedStatus | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    const read = () => {
      void chrome.storage.local.get("mw_embed_status").then((res) => {
        if (mounted) setStatus(res["mw_embed_status"] ?? { state: "idle" });
      });
    };
    read();
    chrome.storage.onChanged.addListener(read);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(read);
    };
  }, []);

  const s = status ?? { state: "idle" as const };
  const stateLabel =
    s.state === "downloading"
      ? s.pct !== undefined
        ? `Preparing model… ${s.pct}%`
        : `Indexing memories… ${s.indexed ?? 0}/${s.total ?? 0}`
      : s.state === "ready"
        ? `Ready — ${s.indexed ?? 0} of ${s.total ?? 0} memories indexed`
        : s.state === "error"
          ? `Unavailable — retries automatically${s.error ? ` (${s.error})` : ""}`
          : "Idle — will prepare on next use";

  return (
    <Card>
      <h3 className="card-title">Semantic search</h3>
      <p className="muted small">
        Matches memories by meaning, not just keywords, using a small AI model that runs entirely
        on this device. One-time ~30MB model download from Hugging Face, cached locally afterwards.
        When unavailable, the wallet silently falls back to keyword matching.
      </p>
      <div className="setting-row">
        <div>
          <strong>Enable semantic matching</strong>
          <p className="muted small">Status: {stateLabel}</p>
        </div>
        <Toggle checked={props.enabled} onChange={props.onToggle} />
      </div>
      <div className="btn-row">
        <button
          className="btn small"
          onClick={() => {
            setMsg("Rebuilding index…");
            void chrome.runtime.sendMessage({ type: EMBED_MSG.REBUILD_INDEX });
          }}
        >
          Rebuild index
        </button>
        <button
          className="btn small"
          onClick={() => {
            setMsg("Clearing model cache…");
            void chrome.runtime.sendMessage({ type: EMBED_MSG.CLEAR_MODEL_CACHE });
          }}
        >
          Clear model cache
        </button>
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </Card>
  );
}

function Settings({ onRunSetup }: { onRunSetup: () => void }) {
  const state = useWalletState();
  if (!state) return null;
  const s = state.settings;

  return (
    <>
      <SectionTitle title="Settings" subtitle="Prototype preferences. All data stays in chrome.storage.local." />
      <div className="stack">
        <Card>
          <div className="setting-row">
            <div>
              <strong>Local-only mode</strong>
              <p className="muted small">Your memory stays on this device in this prototype.</p>
            </div>
            <Toggle checked disabled />
          </div>
          <div className="setting-row">
            <div>
              <strong>Ask for memory before my message is sent</strong>
              <p className="muted small">
                Pauses your message when you hit Enter, shows the permission card first, then sends
                context + question together. Turn off to let messages send immediately and share
                memory afterwards.
              </p>
            </div>
            <Toggle
              checked={s.pauseBeforeShare !== false}
              onChange={(v) =>
                void import("../shared/storage").then((st) => st.saveSettings({ pauseBeforeShare: v }))
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Automatically send context with your question</strong>
              <p className="muted small">
                When approved, the context block and your question are submitted together. Turn off to
                review before sending.
              </p>
            </div>
            <Toggle
              checked={s.autoSendContext}
              onChange={(v) =>
                void import("../shared/storage").then((st) => st.saveSettings({ autoSendContext: v }))
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>When nothing matches, share top general memories</strong>
              <p className="muted small">
                If keyword matching finds no direct match, fill the request with your profile's
                strongest context (education, work, projects). The card preview always shows exactly
                what will be shared.
              </p>
            </div>
            <Toggle
              checked={s.allowGeneralFallback !== false}
              onChange={(v) =>
                void import("../shared/storage").then((st) => st.saveSettings({ allowGeneralFallback: v }))
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Show wallet button on AI sites</strong>
              <p className="muted small">
                A small 🔐 pill on ChatGPT/Claude that re-triggers context sharing for your last
                question. Useful if auto-detection misses a send.
              </p>
            </div>
            <Toggle
              checked={s.showToolbarButton}
              onChange={(v) =>
                void import("../shared/storage").then((st) => st.saveSettings({ showToolbarButton: v }))
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Max memories per request</strong>
              <p className="muted small">How many top-matched memories to include (3–5).</p>
            </div>
            <select
              value={s.maxMemoriesPerRequest}
              onChange={(e) =>
                void import("../shared/storage").then((st) =>
                  st.saveSettings({ maxMemoriesPerRequest: parseInt(e.target.value, 10) }),
                )
              }
            >
              {[3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </Card>

        <SemanticSearchCard
          enabled={s.semanticSearch !== false}
          onToggle={(v) =>
            void import("../shared/storage").then((st) => st.saveSettings({ semanticSearch: v }))
          }
        />

        <Card>
          <h3 className="card-title">Sample data</h3>
          {state.memories.length === 0 ? (
            <>
              <p className="muted small">
                Loads clearly-marked Startup / Work / Personal demo profiles with sample memories and
                sets Startup as the active profile. Only offered while the wallet is empty.
              </p>
              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  onClick={() => void import("../shared/actions").then((a) => a.loadDemoData())}
                >
                  Load sample data
                </button>
              </div>
            </>
          ) : (
            <p className="muted small">
              Sample data is only offered while the wallet is empty, so demo memories can never mix
              with real ones. Factory reset clears everything if you want it back.
            </p>
          )}
          <div className="btn-row">
            <button className="btn" onClick={onRunSetup} title="Reopens the first-run wizard; your data is untouched">
              Run setup again
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (window.confirm("Erase ALL profiles, memories, permissions and settings?")) {
                  void import("../shared/actions").then((a) => a.factoryReset());
                }
              }}
            >
              Factory reset
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}


