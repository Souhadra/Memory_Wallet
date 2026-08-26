/* Visual harness — renders the real UI against a stubbed chrome.* store.
   Open dist/test/ui.html (file://) after a build.
   ?view=popup renders the popup; default renders the dashboard. */

import "./stubChrome";
import { createRoot } from "react-dom/client";
import { App as OptionsApp } from "../options/App";
import { App as PopupApp } from "../popup/App";
import "../ui/tokens.css";
import "../options/styles.css";
import "../popup/styles.css";

const view = new URLSearchParams(window.location.search).get("view") ?? "dashboard";

function TopBar() {
  const link = (v: string, label: string) => (
    <a
      href={`?view=${v}`}
      style={{
        color: view === v ? "#a5b4fc" : "#8b8b98",
        textDecoration: view === v ? "underline" : "none",
        fontSize: 12,
      }}
    >
      {label}
    </a>
  );
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        gap: 16,
        alignItems: "center",
        padding: "8px 16px",
        background: "#16161d",
        borderBottom: "1px solid #26262f",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <strong style={{ fontSize: 12, color: "#ececf1", marginRight: "auto" }}>
        Memory Wallet · visual harness
      </strong>
      {link("dashboard", "Dashboard")}
      {link("popup", "Popup")}
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <>
    <TopBar />
    {view === "popup" ? (
      <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
        <div className="harness-popup-frame">
          <PopupApp />
        </div>
      </div>
    ) : (
      <OptionsApp />
    )}
  </>,
);
