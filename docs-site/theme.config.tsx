import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 600 }}>
      wigtoken <span style={{ opacity: 0.6, fontWeight: 400 }}>docs</span>
    </span>
  ),
  project: {
    link: "https://github.com/wigtn/wigtoken",
  },
  docsRepositoryBase:
    "https://github.com/wigtn/wigtoken/blob/main/docs-site",
  footer: {
    content: "wigtoken — self-hostable Claude Code usage aggregator",
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta property="og:title" content="wigtoken docs" />
      <meta
        property="og:description"
        content="Self-hostable Claude Code token usage aggregator — install, deploy, embed."
      />
    </>
  ),
  color: {
    hue: 270,
    saturation: 70,
  },
};

export default config;
