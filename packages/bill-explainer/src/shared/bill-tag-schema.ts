import { z } from "zod";

/** 議案のテーマ分類結果。実在するタグかどうかは保存前にDBの一覧と照合する。 */
export const billTagAssignmentSchema = z.object({
  labels: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe("議案に当てはまるテーマタグ名。重要な順に1〜3件"),
});

export type BillTagAssignment = z.infer<typeof billTagAssignmentSchema>;
