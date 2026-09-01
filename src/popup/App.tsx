import { useEffect, useMemo, useState } from "react";
import { useWalletState } from "../ui/hooks";
import { memoryCountFor, relativeTime } from "../ui/format";
import {
  addMemory,
  deleteMemory,
  loadDemoData,
  reopenOnboarding,
  setActiveProfile,
} from "../shared/actions";
import {
  IconActivity,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconExternal,
  IconLock,
  IconPlus,
  IconSearch,
  IconSliders,
  IconTrash,
  IconWallet,
  IconX,
  IconZap,
} from "../ui/icons";
import type { MemoryCategory, RequestStatus } from "../shared/types";

const STATUS_META: Record<RequestStatus, { label: string; cls: string }> = {
  approved: { label: "Signed ✓", cls: "chip chip-allow" },
  denied: { label: "Denied ✗", cls: "chip chip-deny" },
  pending: { label: "Pending ⏳", cls: "chip chip-pending" },
};

const CATEGORIES: { id: MemoryCategory; label: string }[] = [
  { id: "preference", label: "Preference" },
  { id: "identity", label: "Identity" },
  { id: "project", label: "Project" },
  { id: "technical", label: "Technical" },
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
  { id: "goal", label: "Goal" },
  { id: "other", label: "Other" },
];

export function App() {
  const state = useWalletState();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [bgOk, setBgOk] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"activity" | "vault">("activity");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);

  // Search & Filter in Vault Tab
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // New Memory Form State
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("project");
  const [newImportance, setNewImportance] = useState(0.8);
  const [savingMemory, setSavingMemory] = useState(false);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "PING" })
      .then((res) => setBgOk(Boolean(res?.ok)))
      .catch(() => setBgOk(false));
  }, []);

  const activeProfile = useMemo(() => {
    if (!state) return null;
    return (
      state.profiles.find((p) => p.id === state.settings.activeProfileId) ??
      state.profiles[0] ??
      null
    );
  }, [state]);

  const activeProfileMemories = useMemo(() => {
    if (!state || !activeProfile) return [];
    return state.memories
      .filter((m) => m.profileId === activeProfile.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state, activeProfile]);

  const filteredMemories = useMemo(() => {
    return activeProfileMemories.filter((m) => {
      const matchCat = selectedCategory === "all" || m.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [activeProfileMemories, selectedCategory, searchQuery]);

  const recentRequests = useMemo(
    () =>
      (state?.requests ?? [])
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
    [state],
  );

  if (!state) {
    return (
      <div className="popup popup-loading">
        <div className="loading-spinner" />
        <span className="muted small">Syncing Memory Wallet…</span>
      </div>
    );
  }

  const walletEmpty = state.memories.length === 0;
  const addressHash = activeProfile
    ? `0xMem…${activeProfile.id.slice(0, 4)}`
    : "0xMem…0000";

  async function handleLoadDemo() {
    setLoadingDemo(true);
    await loadDemoData();
    setLoadingDemo(false);
  }

  function openSettings() {
    void chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#settings") });
  }

  function openDashboard(section = "overview") {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`options/options.html#${section}`) });
  }

  async function handleGetStarted() {
    await reopenOnboarding();
    chrome.runtime.openOptionsPage();
  }

  function handleCopyAddress() {
    if (!activeProfile) return;
    void navigator.clipboard.writeText(
      `[Memory Wallet Identity]\nProfile: ${activeProfile.name} (${activeProfile.id})\nMemories: ${activeProfileMemories.length}\nHash: ${activeProfile.id}`,
    );
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  async function handleSaveNewMemory() {
    if (!activeProfile || !newContent.trim() || savingMemory) return;
    setSavingMemory(true);
    try {
      await addMemory({
        profileId: activeProfile.id,
        content: newContent.trim(),
        category: newCategory,
        importance: newImportance,
      });
      setNewContent("");
      setShowAddDrawer(false);
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleCopyRequestContext(req: (typeof recentRequests)[number]) {
    const matched = state!.memories.filter((m) => req.matchedMemoryIds?.includes(m.id));
    const profile = state!.profiles.find((p) => p.id === req.profileId);
    const text = `[Memory Wallet Context Signature]\nApp: ${req.aiApplicationId}\nProfile: ${profile?.name ?? "Unknown"}\nStatus: ${req.status.toUpperCase()}\nTimestamp: ${new Date(req.createdAt).toISOString()}\n\n${matched.map((m) => `• [${m.category}] ${m.content}`).join("\n")}\n[End Signature]`;
    await navigator.clipboard.writeText(text);
    setCopiedRequestId(req.id);
    setTimeout(() => setCopiedRequestId(null), 2000);
  }

  return (
    <div className="popup">
      {/* ── Top Header: Engine Status & Controls ── */}
      <header className="header">
        <div className="brand" onClick={() => openDashboard("overview")} title="Open Memory Wallet Dashboard">
          <div className="brand-logo-wrap">
            <span className="brand-icon"><IconWallet size={18} /></span>
          </div>
          <div className="brand-info">
            <div className="brand-title-row">
              <span className="brand-title">Memory Wallet</span>
              <span className="brand-version">v1.0</span>
            </div>
            <p className="brand-tagline">AI Sovereign Memory Layer</p>
          </div>
        </div>

        <div className="header-actions">
          <div
            className={`network-badge ${bgOk === true ? "active" : bgOk === false ? "error" : "checking"}`}
            title={
              bgOk
                ? "Neural Vector Engine: Active (100% On-Device & Private)"
                : "Vector Engine Offline — Reload Extension"
            }
          >
            <span className="network-dot" />
            <span className="network-text">{bgOk === false ? "Offline" : "Local Engine"}</span>
          </div>
          <button
            className="btn-icon header-btn"
            title="Settings & Config"
            aria-label="Settings"
            onClick={openSettings}
          >
            <IconSliders size={15} />
          </button>
        </div>
      </header>

      {walletEmpty ? (
        <section className="empty-vault-card anim-scale-in">
          <div className="empty-glow-ring">
            <IconLock size={32} />
          </div>
          <h2 className="empty-title">Initialize Memory Vault</h2>
          <p className="empty-desc">
            Your private, sovereign context store. Connect your memories to ChatGPT, Claude, and AI apps with cryptographic privacy.
          </p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => void handleGetStarted()}>
              <IconZap size={15} /> Get started
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => void handleLoadDemo()}
              disabled={loadingDemo}
            >
              {loadingDemo ? "Generating Demo…" : "Load Sample Persona"}
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* ── MetaMask-Style Account / Persona Vault Card ── */}
          <section className="account-card anim-slide-down">
            <div className="account-top">
              <div className="account-avatar-wrap">
                <span className="account-avatar">{activeProfile?.icon || "📁"}</span>
                <span className="account-avatar-glow" />
              </div>

              <div className="account-details">
                {/* Profile Switcher Trigger */}
                <div className="profile-selector-container">
                  <button
                    className="profile-selector-btn"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    title="Switch Active Profile"
                  >
                    <span className="profile-current-name">{activeProfile?.name || "Select Profile"}</span>
                    <IconChevronDown
                      size={14}
                      className={`selector-chevron ${profileDropdownOpen ? "open" : ""}`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div className="profile-dropdown-menu anim-pop-in">
                      <div className="dropdown-header">
                        <span>Switch Persona Profile</span>
                        <button
                          className="dropdown-close-btn"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <IconX size={12} />
                        </button>
                      </div>
                      <ul className="dropdown-list">
                        {state.profiles.map((p) => {
                          const isSel = p.id === activeProfile?.id;
                          const count = memoryCountFor(state, p.id);
                          return (
                            <li key={p.id}>
                              <button
                                className={`dropdown-item ${isSel ? "active" : ""}`}
                                onClick={() => {
                                  void setActiveProfile(p.id);
                                  setProfileDropdownOpen(false);
                                }}
                              >
                                <span className="dropdown-item-icon">{p.icon}</span>
                                <div className="dropdown-item-text">
                                  <span className="dropdown-item-name">{p.name}</span>
                                  <span className="dropdown-item-count">{count} memories</span>
                                </div>
                                {isSel && <IconCheck size={14} className="dropdown-item-check" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="dropdown-footer">
                        <button
                          className="btn-link-small"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            openDashboard("profiles");
                          }}
                        >
                          <IconPlus size={13} /> Manage / Create Profiles
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Address Hash Pill */}
                <button
                  className="address-hash-pill"
                  onClick={handleCopyAddress}
                  title="Copy Profile Context Address"
                >
                  <span className="hash-code">{addressHash}</span>
                  {copiedHash ? (
                    <span className="copied-text"><IconCheck size={11} /> Copied</span>
                  ) : (
                    <IconCopy size={11} className="copy-icon" />
                  )}
                </button>
              </div>
            </div>

            {/* Account Balance & Stats */}
            <div className="account-balance-row">
              <div className="balance-stat">
                <span className="balance-number">{activeProfileMemories.length}</span>
                <span className="balance-label">Memories Stored</span>
              </div>
              <div className="balance-divider" />
              <div className="balance-stat">
                <span className="balance-number">{state.aiApplications.length}</span>
                <span className="balance-label">Connected AI Apps</span>
              </div>
            </div>

            {/* Account Quick Action Buttons */}
            <div className="account-actions-row">
              <button
                className={`action-pill ${showAddDrawer ? "active" : ""}`}
                onClick={() => setShowAddDrawer(!showAddDrawer)}
                title="Add memory to active profile"
              >
                <IconPlus size={14} />
                <span>Add Memory</span>
              </button>
              <button
                className="action-pill primary"
                onClick={() => openDashboard("overview")}
                title="Open Full Management Dashboard"
              >
                <IconExternal size={14} />
                <span>Open Vault</span>
              </button>
            </div>
          </section>

          {/* ── Inline Quick-Add Memory Drawer ── */}
          {showAddDrawer && (
            <section className="add-memory-drawer anim-slide-down">
              <div className="drawer-head">
                <span className="drawer-title">
                  <IconZap size={14} /> Quick Add to {activeProfile?.name}
                </span>
                <button
                  className="btn-icon-tiny"
                  onClick={() => setShowAddDrawer(false)}
                  title="Close"
                >
                  <IconX size={13} />
                </button>
              </div>
              <textarea
                className="drawer-textarea"
                rows={3}
                placeholder="e.g. Prefers functional React with TypeScript, strict types and Tailwind CSS."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                autoFocus
              />
              <div className="drawer-controls">
                <select
                  className="drawer-select"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="importance-badge" title="Memory Importance Weight">
                  <span>Imp: {(newImportance * 100).toFixed(0)}%</span>
                </div>
                <button
                  className="btn btn-primary btn-drawer-save"
                  disabled={!newContent.trim() || savingMemory}
                  onClick={() => void handleSaveNewMemory()}
                >
                  {savingMemory ? "Saving…" : "Save"}
                </button>
              </div>
            </section>
          )}

          {/* ── Navigation Tabs: Activity Ledger vs Vault Assets ── */}
          <div className="tab-switcher">
            <button
              className={`tab-btn ${activeTab === "activity" ? "active" : ""}`}
              onClick={() => setActiveTab("activity")}
            >
              <IconActivity size={14} />
              <span>Activity Ledger</span>
              {recentRequests.length > 0 && (
                <span className="tab-count">{recentRequests.length}</span>
              )}
            </button>
            <button
              className={`tab-btn ${activeTab === "vault" ? "active" : ""}`}
              onClick={() => setActiveTab("vault")}
            >
              <IconLock size={14} />
              <span>Vault Assets</span>
              <span className="tab-count">{activeProfileMemories.length}</span>
            </button>
          </div>

          {/* ── Tab Content: Activity Ledger ── */}
          {activeTab === "activity" && (
            <section className="tab-pane anim-fade-in">
              {recentRequests.length === 0 ? (
                <div className="empty-tab-state">
                  <span className="empty-tab-icon"><IconActivity size={22} /></span>
                  <p className="empty-tab-text">No memory access requests yet.</p>
                  <p className="empty-tab-sub">
                    Ask a question on ChatGPT or Claude to trigger local context signing.
                  </p>
                </div>
              ) : (
                <ul className="request-ledger-list anim-stagger">
                  {recentRequests.map((r) => {
                    const app = state.aiApplications.find((a) => a.id === r.aiApplicationId);
                    const profile = state.profiles.find((p) => p.id === r.profileId);
                    const meta = STATUS_META[r.status];
                    const matchedCount = r.matchedMemoryIds?.length ?? 0;
                    const isExpanded = expandedRequestId === r.id;
                    const isCopied = copiedRequestId === r.id;

                    return (
                      <li key={r.id} className={`ledger-card ${isExpanded ? "expanded" : ""}`}>
                        <div
                          className="ledger-card-main"
                          onClick={() =>
                            setExpandedRequestId(isExpanded ? null : r.id)
                          }
                        >
                          <div className="ledger-left">
                            <div className="ledger-app-badge">
                              <span className={`app-indicator ${r.aiApplicationId}`} />
                              <span className="app-name">{app?.name ?? r.aiApplicationId}</span>
                            </div>
                            <span className="ledger-query" title={r.query}>
                              "{r.query.slice(0, 48)}{r.query.length > 48 ? "…" : ""}"
                            </span>
                          </div>

                          <div className="ledger-right">
                            <span className={meta.cls}>{meta.label}</span>
                            <span className="ledger-time">{relativeTime(r.createdAt)}</span>
                          </div>
                        </div>

                        {/* Expanded Payload & Signature Details */}
                        {isExpanded && (
                          <div className="ledger-expanded-content anim-slide-down">
                            <div className="ledger-detail-row">
                              <span className="detail-label">Full Prompt:</span>
                              <span className="detail-value">"{r.query}"</span>
                            </div>
                            <div className="ledger-detail-row">
                              <span className="detail-label">Persona Profile:</span>
                              <span className="detail-value">
                                {profile?.icon} {profile?.name}
                              </span>
                            </div>
                            <div className="ledger-detail-row">
                              <span className="detail-label">Context Injected:</span>
                              <span className="detail-value highlight">
                                {matchedCount} {matchedCount === 1 ? "memory" : "memories"}
                              </span>
                            </div>
                            <div className="ledger-actions-row">
                              <button
                                className="btn-small-ghost"
                                onClick={() => void handleCopyRequestContext(r)}
                              >
                                {isCopied ? (
                                  <>
                                    <IconCheck size={12} /> Copied Signature
                                  </>
                                ) : (
                                  <>
                                    <IconCopy size={12} /> Copy Context Payload
                                  </>
                                )}
                              </button>
                              <button
                                className="btn-small-ghost"
                                onClick={() => openDashboard("requests")}
                              >
                                View in Audit Log <IconExternal size={11} />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* ── Tab Content: Vault Assets (Memories) ── */}
          {activeTab === "vault" && (
            <section className="tab-pane anim-fade-in">
              {/* Search & Category Filter Bar */}
              <div className="vault-filter-bar">
                <div className="search-input-wrap">
                  <IconSearch size={14} className="search-icon" />
                  <input
                    type="text"
                    className="vault-search-input"
                    placeholder="Search memories in profile…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear-btn"
                      onClick={() => setSearchQuery("")}
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>

                <div className="category-scroll-pills">
                  <button
                    className={`cat-pill ${selectedCategory === "all" ? "active" : ""}`}
                    onClick={() => setSelectedCategory("all")}
                  >
                    All ({activeProfileMemories.length})
                  </button>
                  {CATEGORIES.map((cat) => {
                    const count = activeProfileMemories.filter((m) => m.category === cat.id).length;
                    if (count === 0 && selectedCategory !== cat.id) return null;
                    return (
                      <button
                        key={cat.id}
                        className={`cat-pill ${selectedCategory === cat.id ? "active" : ""}`}
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        {cat.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Memory List */}
              {filteredMemories.length === 0 ? (
                <div className="empty-tab-state">
                  <span className="empty-tab-icon"><IconLock size={22} /></span>
                  <p className="empty-tab-text">
                    {searchQuery ? "No matching memories found" : "No memories in this profile"}
                  </p>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => setShowAddDrawer(true)}
                  >
                    <IconPlus size={13} /> Add First Memory
                  </button>
                </div>
              ) : (
                <ul className="vault-memory-list anim-stagger">
                  {filteredMemories.map((m) => (
                    <li key={m.id} className="vault-memory-item">
                      <div className="memory-item-body">
                        <p className="memory-item-content">{m.content}</p>
                        <div className="memory-item-meta">
                          <span className={`category-tag ${m.category}`}>{m.category}</span>
                          <span className="importance-tag">
                            Imp: {(m.importance * 100).toFixed(0)}%
                          </span>
                          <span className="memory-time">{relativeTime(m.createdAt)}</span>
                        </div>
                      </div>
                      <div className="memory-item-actions">
                        <button
                          className="btn-icon-tiny"
                          title="Copy memory text"
                          onClick={() => void navigator.clipboard.writeText(m.content)}
                        >
                          <IconCopy size={12} />
                        </button>
                        <button
                          className="btn-icon-tiny danger"
                          title="Delete memory"
                          onClick={() => {
                            if (window.confirm("Delete this memory from your vault?")) {
                              void deleteMemory(m.id);
                            }
                          }}
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ── Footer Bar ── */}
          <footer className="footer">
            <button
              className="btn btn-secondary full-width"
              onClick={() => openDashboard("overview")}
            >
              <IconWallet size={15} /> Open Full Management Dashboard
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
