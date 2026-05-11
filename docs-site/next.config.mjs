import nextra from "nextra";

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
  defaultShowCopyCode: true,
});

const basePath = process.env.DOCS_BASE_PATH ?? "";

export default withNextra({
  output: "export",
  images: { unoptimized: true },
  basePath,
  trailingSlash: true,
});
