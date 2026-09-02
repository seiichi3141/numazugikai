import type { Metadata } from "next";
import { CouncilSessionsPage } from "@/features/council-sessions/server/components/council-sessions-page";

export const metadata: Metadata = {
  title: "定例会・臨時会の一覧 | みらい議会＠沼津市",
  description:
    "沼津市議会の定例会・臨時会の一覧です。会期ごとに提出された議案を辿れます。",
};

export default function GikaiSessionsPage() {
  return <CouncilSessionsPage />;
}
