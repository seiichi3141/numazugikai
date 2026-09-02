import { BILL_THUMBNAIL_SUBJECTS } from "@mirai-gikai/shared/bill-thumbnail/subjects";
import { z } from "zod";

/** モデルに返させる形。key は題材一覧のどれかに限定する。 */
export const thumbnailKeySchema = z.object({
  key: z.enum(BILL_THUMBNAIL_SUBJECTS.map((subject) => subject.key)),
});
