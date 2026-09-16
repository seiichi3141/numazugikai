import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import { publishedClassificationSetFixtureSql } from "./policy-classification-test-fixture";

describe("validate_policy_classification_publication()", () => {
  it("snapshot全件が揃ったreleaseだけを公開できる", () => {
    const output = executeInTestDatabase(`
      begin;
      ${publishedClassificationSetFixtureSql}
      select public.create_topic_classification_population_snapshot(
        'general_question_item', 'release-snapshot', 'council_session', 'v1',
        '00000000-0000-0000-0000-000000000100'
      );
      insert into public.topic_classification_releases (
        id, consumer_type, release_key, taxonomy_id, population_snapshot_id,
        qa_status, publication_state, reviewed_by, reviewed_at
      )
      select
        '00000000-0000-0000-0000-000000000405',
        'general_question_item', 'release-v1',
        '00000000-0000-0000-0000-000000000401', id,
        'verified', 'draft',
        '00000000-0000-0000-0000-000000000109', now()
      from public.topic_classification_population_snapshots
      where snapshot_key = 'release-snapshot';
      insert into public.general_question_classification_release_items (
        release_id, population_snapshot_id, taxonomy_id,
        question_item_revision_id, classification_set_id,
        coverage_disposition
      )
      select
        '00000000-0000-0000-0000-000000000405', id,
        '00000000-0000-0000-0000-000000000401',
        '00000000-0000-0000-0000-000000000302',
        '00000000-0000-0000-0000-000000000404', 'classified'
      from public.topic_classification_population_snapshots
      where snapshot_key = 'release-snapshot';
      update public.topic_classification_releases
      set publication_state = 'published', published_at = now()
      where id = '00000000-0000-0000-0000-000000000405';
      set constraints all immediate;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });

  it("snapshot memberが欠けたreleaseを拒否する", () => {
    expect(() =>
      executeInTestDatabase(`
        begin;
        ${publishedClassificationSetFixtureSql}
        select public.create_topic_classification_population_snapshot(
          'general_question_item', 'incomplete-release', 'council_session', 'v1',
          '00000000-0000-0000-0000-000000000100'
        );
        insert into public.topic_classification_releases (
          consumer_type, release_key, taxonomy_id, population_snapshot_id,
          qa_status, publication_state, reviewed_by, reviewed_at, published_at
        )
        select
          'general_question_item', 'incomplete-release',
          '00000000-0000-0000-0000-000000000401', id,
          'verified', 'published',
          '00000000-0000-0000-0000-000000000109', now(), now()
        from public.topic_classification_population_snapshots
        where snapshot_key = 'incomplete-release';
        set constraints all immediate;
        rollback;
      `)
    ).toThrow(/published classification release is incomplete/);
  });
});
