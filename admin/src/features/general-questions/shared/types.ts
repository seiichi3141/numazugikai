import type { Database } from "@mirai-gikai/supabase";

export type GeneralQuestionQaRow = {
  id: string;
  sourceAppearanceKey: string;
  changeKind: Database["public"]["Enums"]["general_question_change_kind_enum"];
  qaStatus: Database["public"]["Enums"]["qa_status_enum"];
  reviewNote: string | null;
  speakerName: string;
  heldOn: string | null;
  reviewedHeldOn: string | null;
  matchedAppearanceId: string | null;
  reviewedMatchedAppearanceId: string | null;
  matchCandidates: Array<{ id: string; label: string }>;
  questionKind: string;
  deliveryMethod: string;
  items: Array<{
    sourceKey: string;
    label: string;
    parentSourceKey: string | null;
    generatedSummary: string | null;
    reviewedSummary: string | null;
  }>;
  summaryGenerationModel: string | null;
  summaryPromptVersion: string | null;
  answerers: string[];
  createdAt: string;
  applied: boolean;
  validationErrors: string[];
  sourceKind: string;
};

export type GeneralQuestionClassificationRow = {
  itemRevisionId: string;
  summary: string;
  speakerName: string;
  classifiedTopicIds: string[];
  classifiedTopicLabels: string[];
};

export type GeneralQuestionPolicyTopic = {
  id: string;
  label: string;
  description: string;
};
