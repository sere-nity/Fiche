import type { NextConfig } from "next";

const nextConfig: NextConfig = {

    cacheComponents: true,

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
