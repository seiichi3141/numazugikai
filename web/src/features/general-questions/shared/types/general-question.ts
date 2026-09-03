export type GeneralQuestionCoverage = {
  sourceKind: string;
  state: string;
  recordPresence: string;
  disposition: string;
  expectedCount: number | null;
  matchedCount: number | null;
  checkedAt: string;
};

export type GeneralQuestionItem = {
  id: string;
  parentItemId: string | null;
  order: number | null;
  summary: string;
  summaryGenerationModel: string;
  summaryPromptVersion: string;
  topics: Array<{ id: string; slug: string; label: string }>;
};

export type GeneralQuestionAppearance = {
  id: string;
  meetingId: string;
  heldOn: string | null;
  meetingStatus: string;
  meetingTitle: string;
  speakerName: string;
  seatNumber: number | null;
  questionOrder: number | null;
  questionKind: string;
  deliveryMethod: string;
  items: GeneralQuestionItem[];
  answerers: Array<{
    id: string;
    personName: string;
    roleName: string;
    roleGroup: string;
  }>;
  sourceUrl: string | null;
  sourceFetchedAt: string | null;
};

export type GeneralQuestionSession = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  appearances: GeneralQuestionAppearance[];
  coverage: GeneralQuestionCoverage[];
  classificationRelease: {
    id: string;
    taxonomyVersion: string;
  } | null;
};
