import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import { publishedGeneralQuestionItemFixtureSql } from "./policy-classification-test-fixture";

describe("create_topic_classification_population_snapshot()", () => {
  it("公開・確認済みの開催実績に属する項目を順序付きで固定する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${publishedGeneralQuestionItemFixtureSql}
      select public.create_topic_classification_population_snapshot(
        'general_question_item', 'test-snapshot', 'council_session', 'v1',
        '00000000-0000-0000-0000-000000000100'
      );
      do $$
      begin
        if not exists (
          select 1
          from public.topic_classification_population_snapshots
          where snapshot_key = 'test-snapshot'
            and subject_count = 1
            and ordered_subject_ids_hash = md5(
              '00000000-0000-0000-0000-000000000302'
            )
        ) then
          raise exception 'snapshot did not contain the expected item';
        end if;
      end;
      $$;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
