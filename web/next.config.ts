import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  experimental: {
    serverSourceMaps: true,
  },
  typedRoutes: true,
  redirects: async () => [
    {
      // データ利用規約を /developers 配下へ移動した際の旧URL互換
      source: "/interview-data-terms",
      destination: "/developers/interview-data-terms",
      permanent: true,
    },
  ],
  turbopack: {
    root: "../",
  },
  images: {
    /*
      最適化した画像を Vercel 側に長く残す。議案サムネイルは分野ごとの静的画像と
      アップロード時刻入りのファイル名なので中身が変わらず、既定の 60 秒だと同じ
      変換を繰り返して Hobby の変換枠を食いつぶす。差し替えるときはファイル名を変える。
    */
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "127.0.0.1",
        pathname: "/storage/v1/object/public/bill-thumbnails/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/storage/v1/object/public/bill-thumbnails/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/bill-thumbnails/**",
      },
      ...(isDev
        ? [
            {
              protocol: "https" as const,
              hostname: "placehold.co",
            },
          ]
        : []),
    ],
    ...(isDev && {
      dangerouslyAllowSVG: true,
      contentDispositionType: "attachment" as const,
      contentSecurityPolicy:
        "default-src 'self'; script-src 'none'; sandbox;",
    }),
  },
};

export default nextConfig;
