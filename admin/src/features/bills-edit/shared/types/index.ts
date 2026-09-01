import type { Database } from "@mirai-gikai/supabase";
import { z } from "zod";

// 既存の型を再利用
export type Bill = Database["public"]["Tables"]["bills"]["Row"];
export type BillUpdate = Database["public"]["Tables"]["bills"]["Update"];
export type BillInsert = Database["public"]["Tables"]["bills"]["Insert"];

// 公開ステータス型
export type BillPublishStatus = "draft" | "published" | "coming_soon";

// 共通のバリデーションスキーマ
const billBaseSchema = z.object({
  name: z
    .string()
    .min(1, "議案名は必須です")
    .max(200, "議案名は200文字以内で入力してください"),
  status: z.enum([
    "preparing",
    "submitted",
    "in_committee",
    "passed",
    "rejected",
    "consented",
    "approved",
    "certified",
    "adopted",
    "not_adopted",
    "continued",
    "withdrawn",
    "reported",
  ]),
  // 議案番号（例: 議第58号）。取り込みが入れるため手入力では任意
  bill_number: z
    .string()
    .max(50, "議案番号は50文字以内で入力してください")
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  category: z
    .enum([
      "ordinance",
      "budget",
      "settlement",
      "contract",
      "provisional_approval",
      "report",
      "personnel",
      "opinion_paper",
      "petition",
      "other",
    ])
    .nullable()
    .optional(),
  submitter: z
    .enum(["mayor", "member", "committee", "citizen"])
    .nullable()
    .optional(),
  status_note: z
    .string()
    .max(500, "ステータス備考は500文字以内で入力してください")
    .nullable(),
  submitted_date: z
    .string()
    .refine(
      (val) => val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val),
      "議案提出日は YYYY-MM-DD 形式で入力してください"
    )
    .optional(),
  decided_on: z
    .string()
    .refine(
      (val) => val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val),
      "議決日は YYYY-MM-DD 形式で入力してください"
    )
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  thumbnail_url: z.string().nullable().optional(),
  share_thumbnail_url: z.string().nullable().optional(),
  // 議案本文PDFのURL。本文は保持せずリンクのみ持つ
  document_url: z
    .string()
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .refine((val) => val === null || val.startsWith("http"), {
      message: "有効なURLを入力してください",
    })
    .optional(),
  source_url: z
    .string()
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .refine((val) => val === null || val.startsWith("http"), {
      message: "有効なURLを入力してください",
    })
    .optional(),
  is_featured: z.boolean(),
  is_review_completed: z.boolean(),
  council_session_id: z.string().uuid().nullable().optional(),
  slug: z
    .string()
    .max(200, "slugは200文字以内で入力してください")
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  knowledge_source: z
    .string()
    .max(40_000, "ナレッジソースは40,000文字以内で入力してください")
    .optional(),
  use_knowledge_source_in_chat: z.boolean().optional(),
});

// 更新用スキーマ（既存）
export const billUpdateSchema = billBaseSchema;
export type BillUpdateInput = z.infer<typeof billUpdateSchema>;

// 新規作成用スキーマ
export const billCreateSchema = billBaseSchema;
export type BillCreateInput = z.infer<typeof billCreateSchema>;
