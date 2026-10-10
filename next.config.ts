import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  ...(process.env.VERCEL === "1"
    ? {
        webpack(config, { webpack }) {
          const bindingsModule = path.resolve(
            process.cwd(),
            "app/lib/vercel-bindings.ts",
          );

          // The Sites Worker keeps its native bindings. On Vercel, the Node
          // runtime reads email configuration without loading a Worker.
          config.resolve.alias = {
            ...config.resolve.alias,
            "cloudflare:workers$": bindingsModule,
          };
          config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(
              /^cloudflare:workers$/,
              bindingsModule,
            ),
          );
          return config;
        },
      }
    : {}),
};

export default nextConfig;
