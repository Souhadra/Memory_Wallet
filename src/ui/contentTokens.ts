/**
 * Shared design tokens as literal values for shadow-DOM surfaces.
 * Shadow roots can't inherit page-level CSS custom properties, so we
 * inject this stylesheet string into each shadow root to keep them in
 * sync with tokens.css without duplication.
 */
export const CONTENT_TOKENS_CSS = `
/* ── surfaces ── */
--bg: #090a0f;
--bg-subtle: #0e0f17;
--bg-raised: #141522;
--bg-hover: #1c1e30;
--bg-inset: #0b0c13;
--bg-glass: rgba(18, 20, 32, 0.82);
--bg-glass-card: rgba(22, 25, 42, 0.65);

/* ── strokes ── */
--border: #232538;
--border-strong: #31344e;
--border-subtle: #171826;
--border-glass: rgba(255, 255, 255, 0.08);
--border-glass-glow: rgba(99, 102, 241, 0.35);

/* ── text ── */
--text: #f1f2f8;
--text-soft: #c8cad8;
--text-muted: #828599;
--text-faint: #4e5166;

/* ── brand & gradients ── */
--accent: #6366f1;
--accent-hover: #7579f5;
--accent-soft: #191b32;
--accent-text: #a5b4fc;
--accent-glow: rgba(99, 102, 241, 0.3);
--accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%);
--accent-gradient-hover: linear-gradient(135deg, #7579f5 0%, #9d71f7 50%, #22d3ee 100%);
--accent-mesh: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.16) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 80%);

/* ── status & accents ── */
--green: #10b981;
--green-soft: #0c271e;
--green-border: #164e3b;
--green-glow: rgba(16, 185, 129, 0.3);
--red: #f43f5e;
--red-soft: #271118;
--red-border: #521a28;
--amber: #f59e0b;
--amber-soft: #271c0c;
--amber-border: #4d3615;
--cyan: #06b6d4;
--cyan-soft: #0c242c;
--purple: #8b5cf6;
--purple-soft: #1e1533;

/* ── geometry ── */
--radius-xs: 6px;
--radius-sm: 8px;
--radius-md: 11px;
--radius-lg: 16px;
--radius-xl: 22px;
--radius-full: 999px;

/* ── elevation ── */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.35);
--shadow-md: 0 6px 20px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.55);
--shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
--shadow-card-hover: 0 8px 30px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.4), 0 0 20px rgba(99, 102, 241, 0.2);
--shadow-glow: 0 0 0 3px rgba(99, 102, 241, 0.3);
--shadow-glow-cyan: 0 0 20px rgba(6, 182, 212, 0.3);

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
