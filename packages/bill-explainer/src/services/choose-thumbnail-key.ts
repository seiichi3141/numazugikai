import {
  type BillThumbnailSubjectKey,
  isBillThumbnailSubjectKey,
} from "@mirai-gikai/shared/bill-thumbnail/subjects";
import { THUMBNAIL_KEY_TIMEOUT_MS } from "../shared/constants";
import { thumbnailKeySchema } from "../shared/thumbnail-key-schema";
import {
  buildThumbnailKeyPrompt,
  type ThumbnailKeyInput,
} from "../utils/build-thumbnail-key-prompt";
import { createOpenAiObjectGenerator } from "./openai-object-generator";

/**
 * 生成の実行部。テストで Fake に差し替えられるよう切り出す。
 * 返る key は保存前に題材一覧と突き合わせるので、ここでは文字列で受ける。
 */
export type GenerateThumbnailKeyFn = (params: {
  prompt: string;
}) => Promise<{ key: string }>;

/** OpenAI API を直接呼ぶ実装。解説生成と同じモデルを使う。 */
export function createOpenAiThumbnailKeyGenerator(options: {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}): GenerateThumbnailKeyFn {
  return createOpenAiObjectGenerator({
    ...options,
    timeoutMs: options.timeoutMs ?? THUMBNAIL_KEY_TIMEOUT_MS,
    schema: thumbnailKeySchema,
  });
}

/**
 * 議案1件の題材キーを決める。
 *
 * スキーマで候補を絞っていても、モデル側の都合で一覧に無い値が返ることは
 * あり得るため、保存前にもう一度確かめる。
 */
export async function chooseThumbnailKey(params: {
  bill: ThumbnailKeyInput;
  generate: GenerateThumbnailKeyFn;
}): Promise<BillThumbnailSubjectKey> {
  const prompt = buildThumbnailKeyPrompt(params.bill);
  const { key } = await params.generate({ prompt });
  if (!isBillThumbnailSubjectKey(key)) {
    throw new Error(`題材一覧に無い key が返された: ${key}`);
  }
  return key;
}
