import { describe, expect, it } from "vitest";
import { publishedGeneralQuestionAnswererFixtureSql } from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import { publishedGeneralQuestionItemFixtureSql } from "./policy-classification-test-fixture";

describe("list_published_general_question_appearances()", () => {
  it("公開済み登壇枠を会期・年・種別・答弁者でDB側絞り込みする", () => {
    const output = executeInTestDatabase(`begin;
      ${publishedGeneralQuestionAnswererFixtureSql}
      do $check$
      begin
        if not exists (
          select 1
          from public.list_published_general_question_appearances(
            p_limit => 10,
            p_session_slug => 'meeting-fixture-session',
            p_year => 2026,
            p_question_kind => 'personal',
            p_role_group => 'mayor'
          ) page
          where page.appearance_id = '00000000-0000-0000-0000-000000000201'
        ) then raise exception 'matching published row was not returned'; end if;
      end
      $check$;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });

  it("不一致フィルターと直前行カーソルを除外する", () => {
    const output = executeInTestDatabase(`begin;
      ${publishedGeneralQuestionAnswererFixtureSql}
      do $check$
      declare
        first_cursor timestamptz;
      begin
        select page.cursor_at into first_cursor
        from public.list_published_general_question_appearances(p_limit => 1) page;
        if exists (
          select 1
          from public.list_published_general_question_appearances(
            p_limit => 10,
            p_cursor_at => first_cursor,
            p_cursor_id => '00000000-0000-0000-0000-000000000201'
          )
        ) then raise exception 'cursor did not exclude the previous row'; end if;
        if exists (
          select 1
          from public.list_published_general_question_appearances(
            p_limit => 10,
            p_year => 2025
          )
        ) then raise exception 'year filter did not exclude the row'; end if;
      end
      $check$;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });

  it("公開中の分類releaseにある政策分野で絞り込む", () => {
    const output = executeInTestDatabase(`begin;
      ${publishedGeneralQuestionItemFixtureSql}
      select public.classify_general_question_item_manually(
        '00000000-0000-0000-0000-000000000302',
        array['10000000-0000-0000-0000-000000000101'::uuid],
        '00000000-0000-0000-0000-000000000109'
      );
      select public.publish_general_question_classification_release(
        'list-filter-' || gen_random_uuid()::text,
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      do $check$
      begin
        if not exists (
          select 1 from public.list_published_general_question_appearances(
            p_topic_slug => 'disaster-safety'
          )
        ) then raise exception 'released topic did not match'; end if;
        if exists (
          select 1 from public.list_published_general_question_appearances(
            p_topic_slug => 'environment'
          )
        ) then raise exception 'different topic unexpectedly matched'; end if;
      end
      $check$;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });
});
