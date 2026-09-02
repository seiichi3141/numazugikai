import { GoogleAnalytics } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { AuthGate } from "@/components/layouts/auth-gate";
import { Footer } from "@/components/layouts/footer/footer";
import { MainLayout } from "@/components/layouts/main-layout";
import { env } from "@/lib/env";
import { RubyfulInitializer } from "@/lib/rubyful";

export default function MainGroupLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <SpeedInsights />
      <GoogleAnalytics gaId={env.analytics.gaTrackingId ?? ""} />
      <RubyfulInitializer />
      <AuthGate />

      <MainLayout>
        {/*
          本文へのスキップリンク。ヘッダーとカテゴリの並びを毎ページ
          読み飛ばせるようにする。普段は隠し、キーボードで到達したときだけ
          出す。ヘッダーは fixed なので、その下ではなく手前に重ねる。
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:outline-2 focus:outline-offset-2 focus:outline-primary-accent"
        >
          本文へスキップ
        </a>
        <Header />
        <main
          id="main"
          className="min-h-dvh md:min-h-[calc(100dvh-96px)] bg-mirai-surface"
        >
          {children}
        </main>
        <Footer />
      </MainLayout>
    </>
  );
}
