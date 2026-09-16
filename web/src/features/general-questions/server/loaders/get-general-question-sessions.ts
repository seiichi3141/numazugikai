import "server-only";
import {
  findPublishedGeneralQuestionSessionBySlug,
  findPublishedGeneralQuestionSessions,
} from "../repositories/general-question-repository";

export const getGeneralQuestionSessions = findPublishedGeneralQuestionSessions;
export const getGeneralQuestionSessionBySlug =
  findPublishedGeneralQuestionSessionBySlug;
