import { billTagAssignmentSchema } from "../shared/bill-tag-schema";
import { BILL_TAG_TIMEOUT_MS } from "../shared/constants";
import {
  type AvailableBillTag,
  type BillTagPromptInput,
  buildBillTagPrompt,
} from "../utils/build-bill-tag-prompt";
import { createOpenAiObjectGenerator } from "./openai-object-generator";

export type GenerateBillTagsFn = (params: {
  prompt: string;
}) => Promise<{ labels: string[] }>;

export function createOpenAiBillTagsGenerator(options: {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}): GenerateBillTagsFn {
  return createOpenAiObjectGenerator({
    ...options,
    timeoutMs: options.timeoutMs ?? BILL_TAG_TIMEOUT_MS,
    schema: billTagAssignmentSchema,
  });
}

/** AIの出力をDB上のタグと照合し、重複を除いたタグIDを返す。 */
export async function chooseBillTags(params: {
  bill: BillTagPromptInput;
  tags: (AvailableBillTag & { id: string })[];
  generate: GenerateBillTagsFn;
}): Promise<{ id: string; label: string }[]> {
  const prompt = buildBillTagPrompt(params.bill, params.tags);
  const { labels } = await params.generate({ prompt });
  const byLabel = new Map(params.tags.map((tag) => [tag.label, tag]));
  const selected = [];
  for (const label of labels) {
    const tag = byLabel.get(label);
    if (!tag) {
      throw new Error(`タグ候補に無いラベルが返された: ${label}`);
    }
    selected.push(tag);
  }

  return [...new Map(selected.map((tag) => [tag.id, tag])).values()].map(
    ({ id, label }) => ({ id, label })
  );
}
