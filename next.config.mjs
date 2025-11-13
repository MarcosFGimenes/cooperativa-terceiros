import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname, "src"),
    };

    if (process.env.ANALYZE === "true") {
      const outputDir = path.resolve(__dirname, ".next-bundle");
      config.plugins = config.plugins || [];
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.done.tap("NextBundleStatsPlugin", (stats) => {
            const json = stats.toJson({
              all: false,
              assets: true,
              chunks: true,
              chunkModules: true,
              modules: true,
            });

            fs.mkdirSync(outputDir, { recursive: true });
            const target = path.join(outputDir, `stats-${isServer ? "server" : "client"}.json`);
            fs.writeFileSync(target, JSON.stringify(json, null, 2));

            const modules = Array.isArray(json.modules) ? json.modules : [];
            const summary = modules
              .slice()
              .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
              .slice(0, 15)
              .map((mod) => `${mod.size ?? 0} B\t${mod.name}`)
              .join("\n");
            fs.writeFileSync(
              path.join(outputDir, `top-modules-${isServer ? "server" : "client"}.txt`),
              summary,
            );
          });
        },
      });
    }

    return config;
  },
};

export default nextConfig;
