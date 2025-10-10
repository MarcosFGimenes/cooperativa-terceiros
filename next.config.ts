import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Evita falha do build em produção por erros de ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
