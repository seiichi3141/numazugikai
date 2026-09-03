import { describe, expect, it } from "vitest";
import {
  councilMeetingParserFixtureSql,
  publishCouncilMeetingRevisionSql,
} from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("apply_verified_general_question_staging()", () => {
  it("QA済みstagingを根拠付きの公開revisionへ反映する", () => {
    const output =
      executeInTestDatabase(`begin; ${councilMeetingParserFixtureSql}
      insert into public.general_question_import_batches (
        id, parse_run_id, source_version_id, council_session_id, status,
        discovered_count, staged_count, finished_at
      ) values (
        '00000000-0000-0000-0000-000000000601',
        '00000000-0000-0000-0000-000000000104',
        '00000000-0000-0000-0000-000000000102',
        '00000000-0000-0000-0000-000000000100',
        'awaiting_review', 1, 1, now()
      );
      insert into public.general_question_staging_appearances (
        id, batch_id, source_appearance_key, content_fingerprint,
        change_kind, parsed_payload, reviewed_held_on, qa_status, reviewed_by,
        reviewed_at
      ) values (
        '00000000-0000-0000-0000-000000000602',
        '00000000-0000-0000-0000-000000000601', 'appearance-qa-1',
        'sha256:staged', 'new',
        '{
          "sourceKey":"appearance-qa-1",
          "speakerName":"検証議員",
          "seatNumber":9,
          "questionOrder":1,
          "questionKind":"personal",
          "deliveryMethod":"one_by_one",
          "heldOn":null,
          "items":[
            {"sourceKey":"item-1","order":1,"parentSourceKey":null,"label":"防災対策について"},
            {"sourceKey":"item-1-1","order":1,"parentSourceKey":"item-1","label":"避難所について"}
          ],
          "answerers":["市長","危機管理部長"]
        }'::jsonb, '2026-09-04',
        'verified', '00000000-0000-0000-0000-000000000109', now()
      );
      select public.apply_verified_general_question_staging(
        '00000000-0000-0000-0000-000000000602',
        '00000000-0000-0000-0000-000000000109'
      );
      select public.refresh_general_question_batch_publication(
        '00000000-0000-0000-0000-000000000602',
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      do $check$
      begin
        if (select count(*) from public.general_question_appearance_revisions
          where speaker_display_name = '検証議員' and qa_status = 'verified'
            and publication_state = 'published') <> 1 then
          raise exception 'published appearance was not created';
        end if;
        if (select count(*) from public.general_question_item_revisions
          where qa_status = 'verified' and publication_state = 'published') <> 2 then
          raise exception 'published items were not created';
        end if;
        if (select count(*) from public.general_question_answerer_revisions
          where qa_status = 'verified' and publication_state = 'published') <> 2 then
          raise exception 'published answerers were not created';
        end if;
        if (select count(*) from public.general_question_session_coverage_observations
          where qa_status = 'verified' and publication_state = 'published'
            and expected_count = 1 and matched_count = 1) <> 1 then
          raise exception 'published coverage was not created';
        end if;
      end
      $check$;
      set constraints all deferred;
      insert into public.ingestion_parse_runs (
        id, ingestion_run_id, source_version_id, parser_name,
        parser_version, configuration_hash
      ) values (
        '00000000-0000-0000-0000-000000000604',
        '00000000-0000-0000-0000-000000000103',
        '00000000-0000-0000-0000-000000000102',
        'meeting-fixture-parser', '2.0.0', 'sha256:changed-config'
      );
      select public.finalize_ingestion_parse_run(
        '00000000-0000-0000-0000-000000000604',
        'completed', '{}'::jsonb, now()
      );
      insert into public.general_question_import_batches (
        id, parse_run_id, source_version_id, council_session_id, status,
        discovered_count, staged_count, finished_at
      ) values (
        '00000000-0000-0000-0000-000000000605',
        '00000000-0000-0000-0000-000000000604',
        '00000000-0000-0000-0000-000000000102',
        '00000000-0000-0000-0000-000000000100',
        'awaiting_review', 1, 1, now()
      );
      insert into public.general_question_staging_appearances (
        id, batch_id, source_appearance_key, content_fingerprint,
        change_kind, matched_appearance_id, parsed_payload, qa_status,
        reviewed_by, reviewed_at
      ) select
        '00000000-0000-0000-0000-000000000606',
        '00000000-0000-0000-0000-000000000605', 'appearance-qa-1',
        'sha256:corrected', 'changed', application.appearance_id,
        '{
          "sourceKey":"appearance-qa-1",
          "speakerName":"検証議員（訂正）",
          "seatNumber":9,
          "questionOrder":1,
          "questionKind":"personal",
          "deliveryMethod":"one_by_one",
          "heldOn":"2026-09-04",
          "items":[
            {"sourceKey":"item-1","order":1,"parentSourceKey":null,"label":"防災対策の訂正版"}
          ],
          "answerers":["危機管理監"]
        }'::jsonb,
        'verified', '00000000-0000-0000-0000-000000000109', now()
      from public.general_question_staging_applications application
      where application.staging_id
        = '00000000-0000-0000-0000-000000000602';
      select public.apply_verified_general_question_staging(
        '00000000-0000-0000-0000-000000000606',
        '00000000-0000-0000-0000-000000000109'
      );
      select public.refresh_general_question_batch_publication(
        '00000000-0000-0000-0000-000000000606',
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      do $correction_check$
      begin
        if (select count(*) from public.general_question_appearance_revisions
          where speaker_display_name = '検証議員（訂正）'
            and publication_state = 'published') <> 1 then
          raise exception 'corrected appearance was not published';
        end if;
        if (select count(*) from public.general_question_item_revisions
          where publication_state = 'published') <> 1 then
          raise exception 'removed item remained published';
        end if;
        if (select count(*) from public.general_question_answerer_revisions
          where publication_state = 'published') <> 1 then
          raise exception 'removed answerer remained published';
        end if;
        if not exists (
          select 1
          from public.general_question_session_coverage_observations
          where publication_state = 'published'
            and expected_count = 1 and matched_count = 1
        ) then raise exception 'superseded batch was counted twice'; end if;
      end
      $correction_check$;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });

  it("本文非保持の会議記録を人手確認根拠として反映する", () => {
    const output =
      executeInTestDatabase(`begin; ${councilMeetingParserFixtureSql}
      insert into public.ingestion_sources (id, source, url)
      values (
        '00000000-0000-0000-0000-000000000701',
        'general_question_record',
        'https://ami-search.amivoice.com/numazu/usr/search.exe?vcsv=test'
      );
      insert into public.ingestion_source_versions (
        id, ingestion_source_id, content_hash, fetched_at, media_type
      ) values (
        '00000000-0000-0000-0000-000000000702',
        '00000000-0000-0000-0000-000000000701',
        'sha256:minutes', now(), 'text/html'
      );
      select public.transition_ingestion_source_version_retention(
        '00000000-0000-0000-0000-000000000702', 'not_permitted',
        '00000000-0000-0000-0000-000000000109',
        '本文を保持しない', null
      );
      insert into public.ingestion_runs (id, source)
      values (
        '00000000-0000-0000-0000-000000000703',
        'general_question_record'
      );
      insert into public.ingestion_parse_runs (
        id, ingestion_run_id, source_version_id, parser_name,
        parser_version, configuration_hash
      ) values (
        '00000000-0000-0000-0000-000000000704',
        '00000000-0000-0000-0000-000000000703',
        '00000000-0000-0000-0000-000000000702',
        'minutes-parser', '1.0.0', 'sha256:minutes-parser'
      );
      select public.finalize_ingestion_parse_run(
        '00000000-0000-0000-0000-000000000704',
        'completed', '{}'::jsonb, now()
      );
      insert into public.general_question_import_batches (
        id, parse_run_id, source_version_id, council_session_id, status,
        discovered_count, staged_count, finished_at
      ) values (
        '00000000-0000-0000-0000-000000000705',
        '00000000-0000-0000-0000-000000000704',
        '00000000-0000-0000-0000-000000000702',
        '00000000-0000-0000-0000-000000000100',
        'awaiting_review', 1, 1, now()
      );
      insert into public.general_question_staging_appearances (
        id, batch_id, source_appearance_key, content_fingerprint,
        change_kind, parsed_payload, qa_status, reviewed_by, reviewed_at
      ) values (
        '00000000-0000-0000-0000-000000000706',
        '00000000-0000-0000-0000-000000000705',
        'minutes:appearance-1', 'sha256:minutes-appearance', 'new',
        '{
          "sourceKey":"minutes:appearance-1",
          "speakerName":"会議記録議員",
          "seatNumber":3,
          "questionOrder":1,
          "questionKind":"unknown",
          "deliveryMethod":"unknown",
          "heldOn":"2026-09-05",
          "items":[],
          "answerers":["市長"]
        }'::jsonb,
        'verified', '00000000-0000-0000-0000-000000000109', now()
      );
      select public.apply_verified_general_question_staging(
        '00000000-0000-0000-0000-000000000706',
        '00000000-0000-0000-0000-000000000109'
      );
      select public.refresh_general_question_batch_publication(
        '00000000-0000-0000-0000-000000000706',
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      do $check$
      begin
        if not exists (
          select 1 from public.general_question_appearance_sources
          where extraction_method = 'manual' and parse_run_id is null
            and qa_status = 'verified'
        ) then raise exception 'manual appearance evidence was not created'; end if;
        if not exists (
          select 1 from public.general_question_session_coverage_observations
          where source_kind = 'meeting_record'
            and publication_state = 'published'
        ) then raise exception 'meeting record coverage was not published'; end if;
        if exists (
          select 1 from public.ingestion_source_versions
          where id = '00000000-0000-0000-0000-000000000702'
            and (artifact_retention_state <> 'not_permitted'
              or private_object_key is not null)
        ) then raise exception 'meeting record body retention is invalid'; end if;
      end
      $check$;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });

  it("人手突合した別資料を既存の会議・登壇枠へ結び付ける", () => {
    const output = executeInTestDatabase(`begin;
      ${councilMeetingParserFixtureSql}
      ${publishCouncilMeetingRevisionSql}
      insert into public.general_question_appearances (
        id, meeting_id, appearance_key
      ) values (
        '00000000-0000-0000-0000-000000000801',
        '00000000-0000-0000-0000-000000000105',
        'existing-appearance'
      );
      insert into public.general_question_appearance_revisions (
        id, appearance_id, meeting_id, revision_number,
        speaker_display_name, question_order, question_kind, delivery_method
      ) values (
        '00000000-0000-0000-0000-000000000808',
        '00000000-0000-0000-0000-000000000801',
        '00000000-0000-0000-0000-000000000105',
        1, 'PDF確認済み議員', 1, 'personal', 'one_by_one'
      );
      insert into public.general_question_appearance_source_occurrences (
        id, appearance_id, meeting_id, meeting_source_occurrence_id,
        ingestion_source_id, source_appearance_key
      ) values (
        '00000000-0000-0000-0000-000000000809',
        '00000000-0000-0000-0000-000000000801',
        '00000000-0000-0000-0000-000000000105',
        '00000000-0000-0000-0000-000000000107',
        '00000000-0000-0000-0000-000000000101',
        'existing-appearance'
      );
      insert into public.general_question_appearance_sources (
        appearance_source_occurrence_id, appearance_revision_id,
        appearance_id, meeting_id, ingestion_source_id, source_version_id,
        parse_run_id, source_locator, extraction_method, qa_status,
        verified_by, verified_at
      ) values (
        '00000000-0000-0000-0000-000000000809',
        '00000000-0000-0000-0000-000000000808',
        '00000000-0000-0000-0000-000000000801',
        '00000000-0000-0000-0000-000000000105',
        '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000102',
        '00000000-0000-0000-0000-000000000104',
        'appearance=existing-appearance', 'parser', 'verified',
        '00000000-0000-0000-0000-000000000109', now()
      );
      update public.general_question_appearance_revisions
      set qa_status = 'verified',
          reviewed_by = '00000000-0000-0000-0000-000000000109',
          reviewed_at = now()
      where id = '00000000-0000-0000-0000-000000000808';
      update public.general_question_appearance_revisions
      set publication_state = 'reviewed'
      where id = '00000000-0000-0000-0000-000000000808';
      update public.general_question_appearance_revisions
      set publication_state = 'published', published_at = now()
      where id = '00000000-0000-0000-0000-000000000808';
      insert into public.ingestion_sources (id, source, url) values (
        '00000000-0000-0000-0000-000000000802',
        'general_question_record',
        'https://ami-search.amivoice.com/numazu/usr/search.exe?vcsv=matched'
      );
      insert into public.ingestion_source_versions (
        id, ingestion_source_id, content_hash, fetched_at, media_type
      ) values (
        '00000000-0000-0000-0000-000000000803',
        '00000000-0000-0000-0000-000000000802',
        'sha256:matched-minutes', now(), 'text/html'
      );
      select public.transition_ingestion_source_version_retention(
        '00000000-0000-0000-0000-000000000803', 'not_permitted',
        '00000000-0000-0000-0000-000000000109',
        '本文を保持しない', null
      );
      insert into public.ingestion_runs (id, source) values (
        '00000000-0000-0000-0000-000000000804',
        'general_question_record'
      );
      insert into public.ingestion_parse_runs (
        id, ingestion_run_id, source_version_id, parser_name,
        parser_version, configuration_hash
      ) values (
        '00000000-0000-0000-0000-000000000805',
        '00000000-0000-0000-0000-000000000804',
        '00000000-0000-0000-0000-000000000803',
        'minutes-parser', '1.0.0', 'sha256:matched-parser'
      );
      select public.finalize_ingestion_parse_run(
        '00000000-0000-0000-0000-000000000805',
        'completed', '{}'::jsonb, now()
      );
      insert into public.general_question_import_batches (
        id, parse_run_id, source_version_id, council_session_id, status,
        discovered_count, staged_count, finished_at
      ) values (
        '00000000-0000-0000-0000-000000000806',
        '00000000-0000-0000-0000-000000000805',
        '00000000-0000-0000-0000-000000000803',
        '00000000-0000-0000-0000-000000000100',
        'awaiting_review', 1, 1, now()
      );
      insert into public.general_question_staging_appearances (
        id, batch_id, source_appearance_key, content_fingerprint,
        change_kind, reviewed_matched_appearance_id, parsed_payload,
        qa_status, reviewed_by, reviewed_at
      ) values (
        '00000000-0000-0000-0000-000000000807',
        '00000000-0000-0000-0000-000000000806',
        'minutes:matched', 'sha256:matched-appearance', 'new',
        '00000000-0000-0000-0000-000000000801',
        '{
          "sourceKey":"minutes:matched",
          "speakerName":"突合済み議員",
          "seatNumber":4,
          "questionOrder":1,
          "questionKind":"unknown",
          "deliveryMethod":"unknown",
          "heldOn":"2026-09-03",
          "items":[],
          "answerers":[]
        }'::jsonb,
        'verified', '00000000-0000-0000-0000-000000000109', now()
      );
      select public.apply_verified_general_question_staging(
        '00000000-0000-0000-0000-000000000807',
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      do $check$
      begin
        if (select count(*) from public.council_meetings) <> 1 then
          raise exception 'a duplicate meeting was created';
        end if;
        if (select count(*) from public.general_question_appearances) <> 1 then
          raise exception 'a duplicate appearance was created';
        end if;
        if not exists (
          select 1 from public.general_question_appearance_revisions
          where id = '00000000-0000-0000-0000-000000000808'
            and speaker_display_name = 'PDF確認済み議員'
            and publication_state = 'published'
        ) then raise exception 'the richer published revision was replaced'; end if;
        if not exists (
          select 1 from public.council_meeting_source_evidence
          where ingestion_source_id = '00000000-0000-0000-0000-000000000802'
            and extraction_method = 'manual' and qa_status = 'verified'
        ) then raise exception 'matched meeting evidence was not created'; end if;
      end
      $check$;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });
});
