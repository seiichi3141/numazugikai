import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { INTERVIEW_COLLECTION_ENABLED } from "@/features/interview-config/shared/constants";

export default function InterviewPreviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!INTERVIEW_COLLECTION_ENABLED) {
    notFound();
  }

  return children;
}
