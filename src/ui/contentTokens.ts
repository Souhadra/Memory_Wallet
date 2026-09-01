/**
 * Shared design tokens as literal values for shadow-DOM surfaces.
 * Shadow roots can't inherit page-level CSS custom properties, so we
 * inject this stylesheet string into each shadow root to keep them in
 * sync with tokens.css without duplication.
 */
export const CONTENT_TOKENS_CSS = `
/* ── surfaces ── */
--bg: #0c0c10;
--bg-subtle: #101015;
--bg-raised: #151520;
--bg-hover: #1a1a26;
--bg-inset: #111118;
--bg-glass: rgba(21, 21, 32, 0.85);

/* ── strokes ── */
--border: #232330;
--border-strong: #2e2e3e;
--border-subtle: #1c1c28;

/* ── text ── */
--text: #ececf1;
--text-soft: #c5c5d0;
--text-muted: #848494;
--text-faint: #50505e;

/* ── brand ── */
--accent: #6366f1;
--accent-hover: #7579f5;
--accent-soft: #1e1e35;
--accent-text: #a5b4fc;
--accent-glow: rgba(99, 102, 241, 0.25);

/* ── status ── */
--green: #34d399;
--green-soft: #0f251d;
--green-border: #1b4032;
--red: #f87171;
--red-soft: #201218;
--red-border: #442028;
--amber: #fbbf24;
--amber-soft: #261f0e;
--amber-border: #40351a;

/* ── geometry ── */
--radius-xs: 6px;
--radius-sm: 8px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 18px;
--radius-full: 999px;

/* ── elevation ── */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.25);
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.35);
--shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.45);
--shadow-glow: 0 0 0 3px rgba(99, 102, 241, 0.25);

/* ── motion ── */
--ease: cubic-bezier(0.2, 0.7, 0.3, 1);
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--dur-fast: 120ms;
--dur-normal: 200ms;
--dur-slow: 350ms;

/* ── typography ── */
--text-2xs: 10px;
--text-xs: 11px;
--text-sm: 12px;
--text-base: 13px;
--text-md: 14px;
--text-lg: 15px;
--text-xl: 17px;
--text-2xl: 20px;
--text-3xl: 26px;
--leading-tight: 1.2;
--leading-normal: 1.45;
--leading-relaxed: 1.6;
--fw-normal: 400;
--fw-medium: 500;
--fw-semibold: 600;
--fw-bold: 700;
--fw-extrabold: 800;

/* ── spacing ── */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
`;

/**
 * Build a <style> element containing all content-token variables so shadow
 * roots can reference them.  Returns a ready-to-append style element.
 */
export function buildTokenStyleEl(): HTMLStyleElement {
  const el = document.createElement("style");
  el.textContent = `:host, :root { ${CONTENT_TOKENS_CSS} }`;
  return el;
}
