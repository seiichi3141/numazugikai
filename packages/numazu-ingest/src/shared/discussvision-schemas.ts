import { z } from "zod";

/**
 * 沼津市議会の議会中継システム（DiscussVision SMART）が返すJSONのスキーマ。
 *
 * 非公式APIのため予告なく形が変わりうる。取り込み時に必ず検証し、
 * 想定と違えば静かに壊れるのではなく落とす。
 */

/** 年度一覧: `GET /dvsapi/yearlist?tenant_id=436` */
export const yearListSchema = z.array(
  z.object({
    /** 例: "令和8年" */
    label: z.string(),
    /** 例: 2026 */
    value: z.number(),
  })
);
export type YearListItem = z.infer<typeof yearListSchema>[number];

/** 発言（プレイリスト）1件 */
export const playlistItemSchema = z.object({
  playlist_id: z.string(),
  /** 発言者名。議事進行など発言者が紐づかない項目では null */
  speaker: z.string().nullable(),
  speaker_id: z.string().nullable(),
  speaker_img: z.string().nullable(),
  /** 発言の見出し（質問項目など） */
  content: z.string().nullable(),
  movie_name1: z.string().nullable(),
  time_duration: z.string().nullable(),
});
export type PlaylistItem = z.infer<typeof playlistItemSchema>;

/** 会議の日程1件 */
export const scheduleSchema = z.object({
  schedule_id: z.string(),
  /** 例: "02月06日　本会議" */
  label: z.string(),
  is_newest: z.boolean().optional(),
  playlist: z.array(playlistItemSchema).default([]),
});
export type Schedule = z.infer<typeof scheduleSchema>;

/** 会議1件: `GET /dvsapi/councilrd/all?tenant_id=436&year=2026` */
export const councilSchema = z.object({
  council_id: z.string(),
  /** 会議の開催年。"2026-03-17" のような日付文字列で返る */
  year: z.string(),
  /** 例: "令和8年第12回定例会" */
  label: z.string(),
  schedules: z.array(scheduleSchema).default([]),
});
export type Council = z.infer<typeof councilSchema>;

export const councilListSchema = z.array(councilSchema);

/** 会派と所属議員: `GET /dvsapi/group/memberlist?tenant_id=436&type=1` */
export const groupMemberListSchema = z.array(
  z.object({
    /** 会派ID */
    value: z.string(),
    /** 会派名。例: "志政会" */
    label: z.string(),
    lists: z
      .array(
        z.object({
          /** 例: "浅原和美議員" */
          label: z.string(),
          /** 議員ID */
          value: z.string(),
        })
      )
      .default([]),
  })
);
export type GroupMemberList = z.infer<typeof groupMemberListSchema>;

/** 議員一覧: `GET /dvsapi/speaker/list?tenant_id=436&search_index=1` */
export const speakerListSchema = z.object({
  speaker_list: z.array(
    z.object({
      speaker_id: z.string(),
      name: z.string(),
      name_kana: z.string().nullable(),
      /** 例: "議員" */
      honorific: z.string().nullable(),
      picture_name: z.string().nullable(),
      /** [氏名, 会派, ...] の並び。項目名は item_list 側にある */
      details: z.array(z.string()).default([]),
    })
  ),
});
export type SpeakerList = z.infer<typeof speakerListSchema>;

/** 発言全文: `GET /dvsapi/minute/text?tenant_id=436&council_id=..&schedule_id=..&playlist_id=..` */
export const minuteTextSchema = z.array(
  z.object({
    minute_text: z.string(),
  })
);
