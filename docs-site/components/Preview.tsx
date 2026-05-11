/**
 * Inline preview of a single section from the live demo site. Renders
 * an iframe pointing at /demo/?focus=<section>, which makes the demo
 * App.tsx skip its chrome (header / ConfigBar / footer / Section
 * title) and only render that section's children.
 *
 * Heights are picked per-section by the caller because iframes can't
 * auto-size cross-document without postMessage plumbing — and we
 * don't need that level of polish for the docs.
 */
interface PreviewProps {
  section: string;
  height?: number;
  basePath?: string;
}

export default function Preview({
  section,
  height = 220,
  basePath = "/wigtoken",
}: PreviewProps) {
  const src = `${basePath}/demo/?focus=${section}`;
  return (
    <div
      style={{
        marginTop: "1rem",
        marginBottom: "1rem",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--nextra-border, #2a2a2a)",
        background: "#0a0a0a",
      }}
    >
      <iframe
        src={src}
        title={`${section} preview`}
        loading="lazy"
        style={{
          width: "100%",
          height,
          border: "none",
          display: "block",
        }}
      />
      <div
        style={{
          padding: "6px 10px",
          fontSize: 11,
          color: "var(--nextra-muted, #888)",
          borderTop: "1px solid var(--nextra-border, #2a2a2a)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Live preview · streams from the demo server</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--nextra-muted, #888)", textDecoration: "underline" }}
        >
          open ↗
        </a>
      </div>
    </div>
  );
}
