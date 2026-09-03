import "server-only";
import { findGeneralQuestionQaRows } from "../repositories/general-question-qa-repository";

export async function loadGeneralQuestionQa(params: {
  page: number;
  pageSize: number;
}) {
  return findGeneralQuestionQaRows(params);
}
