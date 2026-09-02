"use server";

import {
  INTERVIEW_COLLECTION_ENABLED,
  INTERVIEW_UNAVAILABLE_MESSAGE,
} from "@/features/interview-config/shared/constants";
import type { InterviewSession } from "../../shared/types";
import { createInterviewSessionCore } from "../services/create-interview-session-core";

export async function createInterviewSession({
  interviewConfigId,
}: {
  interviewConfigId: string;
}): Promise<InterviewSession> {
  if (!INTERVIEW_COLLECTION_ENABLED) {
    throw new Error(INTERVIEW_UNAVAILABLE_MESSAGE);
  }

  return createInterviewSessionCore({ interviewConfigId });
}
