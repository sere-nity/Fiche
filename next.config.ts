import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The books are read from disk at runtime (e.g. by the gist check), so make
  // sure the .md files ship with every server function.
  outputFileTracingIncludes: { "/**": ["./data/texts/**"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
