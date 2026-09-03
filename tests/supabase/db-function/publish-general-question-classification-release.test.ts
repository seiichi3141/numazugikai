import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import { publishedGeneralQuestionItemFixtureSql } from "./policy-classification-test-fixture";

describe("publish_general_question_classification_release()", () => {
  it("snapshot全件の分類が揃ったreleaseを公開する", () => {
    const output = executeInTestDatabase(`begin;
      ${publishedGeneralQuestionItemFixtureSql}
      select public.classify_general_question_item_manually(
        '00000000-0000-0000-0000-000000000302',
        array['10000000-0000-0000-0000-000000000101'::uuid],
        '00000000-0000-0000-0000-000000000109'
      );
      select public.publish_general_question_classification_release(
        'test-release-' || gen_random_uuid()::text,
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });

  it("再分類中は現行releaseを維持し、新releaseで原子的に切り替える", () => {
    const output = executeInTestDatabase(`begin;
      ${publishedGeneralQuestionItemFixtureSql}
      select public.classify_general_question_item_manually(
        '00000000-0000-0000-0000-000000000302',
        array['10000000-0000-0000-0000-000000000101'::uuid],
        '00000000-0000-0000-0000-000000000109'
      );
      select public.publish_general_question_classification_release(
        'release-v1-' || gen_random_uuid()::text,
        '00000000-0000-0000-0000-000000000109'
      );
      select public.classify_general_question_item_manually(
        '00000000-0000-0000-0000-000000000302',
        array['10000000-0000-0000-0000-000000000106'::uuid],
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      do $check$
      begin
        if (select count(*) from public.topic_classification_releases
          where consumer_type = 'general_question_item'
            and publication_state = 'published') <> 1 then
          raise exception 'active release was not preserved';
        end if;
      end
      $check$;
      select public.publish_general_question_classification_release(
        'release-v2-' || gen_random_uuid()::text,
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      do $check$
      begin
        if (select count(*) from public.topic_classification_releases
          where consumer_type = 'general_question_item'
            and publication_state = 'published') <> 1 then
          raise exception 'new release was not published';
        end if;
        if not exists (
          select 1
          from public.general_question_classification_release_items release_item
          join public.topic_classification_releases release
            on release.id = release_item.release_id
          join public.general_question_item_topics topic
            on topic.classification_set_id = release_item.classification_set_id
          where release.publication_state = 'published'
            and topic.policy_topic_id
              = '10000000-0000-0000-0000-000000000106'
        ) then raise exception 'new classification was not released'; end if;
      end
      $check$;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });
});
