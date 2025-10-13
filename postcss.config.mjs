import { createRequire } from "module";

const require = createRequire(import.meta.url);

let tailwindcssPlugin;

try {
  // Attempt to resolve and load the official Tailwind CSS PostCSS plugin.
  const resolvedPath = require.resolve("@tailwindcss/postcss");
  const imported = await import(resolvedPath);
  tailwindcssPlugin = imported.default ?? imported;
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") {
    console.warn(
      "Falling back to local Tailwind CSS PostCSS plugin shim due to error:",
      error,
    );
  }
  const fallback = await import("./tailwind.postcss-fallback.mjs");
  tailwindcssPlugin = fallback.default;
}

const config = {
  plugins: [tailwindcssPlugin()],
};

export default config;
