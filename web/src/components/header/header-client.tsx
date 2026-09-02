"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DifficultySelector } from "@/features/bill-difficulty/client/components/difficulty-selector";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { InterviewHeaderActions } from "@/features/interview-session/client/components/interview-header-actions";
import { sendDifficultyStateEvent } from "@/lib/analytics/preference-state-events";
import { useOnPageView } from "@/lib/analytics/use-on-page-view";
import { isInterviewPage, isMainPage } from "@/lib/page-layout-utils";
import { routes } from "@/lib/routes";
import { RubyToggle } from "@/lib/rubyful";
import { DesktopNavigation } from "./desktop-navigation";
import { HamburgerMenu } from "./hamburger-menu";
import { SiteTitle } from "./site-title";

interface HeaderClientProps {
  difficultyLevel: DifficultyLevelEnum;
}

export function HeaderClient({ difficultyLevel }: HeaderClientProps) {
  const pathname = usePathname();
  const showDifficultySelector = isMainPage(pathname);
  const showInterviewActions = isInterviewPage(pathname);

  // Headerは1ページに1つだけ常時マウントされるため、
  // ここで難易度設定をページ表示のたびにGAへ送る
  // (DifficultySelectorはmarkdown埋め込み等で複数箇所に
  //  同時マウントされ得るため、送信元には適さない)
  useOnPageView(() => sendDifficultyStateEvent(difficultyLevel));

  return (
    <header className="px-3 fixed top-4 left-0 right-0 z-40 max-w-[1440px] mx-auto">
      <div className="rounded-2xl bg-card shadow-sm mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* Logo / Site Title */}
          <div className="flex items-center">
            <Link
              href={routes.home()}
              className="flex items-center space-x-2"
              aria-label="ホーム"
            >
              <Image
                src="/img/logo.svg"
                alt="みらい議会＠沼津市"
                width={36}
                height={40}
              />
              <SiteTitle />
            </Link>
          </div>

          <DesktopNavigation pathname={pathname} />

          {/* Difficulty and interview controls */}
          <nav
            className="flex items-center space-x-2 xl:justify-self-end"
            aria-label="補助ナビゲーション"
          >
            {showDifficultySelector && (
              <DifficultySelector currentLevel={difficultyLevel} />
            )}
            {showInterviewActions && <InterviewHeaderActions />}
            <div className="hidden xl:block">
              <RubyToggle />
            </div>
            <div className="hidden xl:block">
              <ThemeToggle />
            </div>
            <HamburgerMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
