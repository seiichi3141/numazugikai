import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

const fiscalEvidenceFixtureSql = `
  insert into public.ingestion_sources (id, source, url) values (
    '10000000-0000-0000-0000-000000000001',
    'fiscal_test', 'https://example.com/fiscal-source.pdf'
  );
  insert into public.ingestion_source_versions (
    id, ingestion_source_id, content_hash, fetched_at
  ) values (
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'sha256:fiscal-evidence-fixture', now()
  );
  insert into public.fiscal_source_documents (
    id, source_kind, series_code
  ) values (
    '10000000-0000-0000-0000-000000000003',
    'budget_overview', 'fiscal-evidence-fixture'
  );
  insert into public.fiscal_source_document_editions (
    id, fiscal_source_document_id, edition_key
  ) values (
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003', 'fy2088'
  );
  insert into public.fiscal_source_document_edition_source_occurrences (
    id, edition_id, fiscal_source_document_id,
    ingestion_source_id, source_edition_key
  ) values (
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001', 'fy2088'
  );
  insert into public.fiscal_source_document_edition_observations (
    id, edition_id, fiscal_source_document_id,
    edition_source_occurrence_id, ingestion_source_id,
    source_version_id, observation_revision, evidence_revision,
    extraction_method, source_locator, title, fiscal_year,
    publisher
  ) values (
    '10000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    1, 1, 'manual', 'page=1', '財政根拠fixture', 2088,
    '沼津市'
  );
`;

describe("財政監査根拠chain", () => {
  it("coverage・分類・mapping・議案リンクを同じ取得版へ結ぶ", () => {
    const result = executeInTestDatabase(`
      begin;
      ${fiscalEvidenceFixtureSql}
      do $$
      declare
        scope_id uuid;
        coverage_id uuid;
        coverage_occurrence_id uuid;
        coverage_observation_id uuid;
        classification_id uuid;
        classification_revision_id uuid;
        classification_occurrence_id uuid;
        mapping_id uuid;
        mapping_revision_id uuid;
        mapping_occurrence_id uuid;
        event_id uuid;
        link_id uuid;
        link_revision_id uuid;
        link_occurrence_id uuid;
      begin
        select id into scope_id from public.fiscal_reporting_scopes
          where code = 'general_account';

        insert into public.fiscal_data_coverage (
          fiscal_year, reporting_scope_id, source_kind, data_kind
        ) values (2088, scope_id, 'budget_overview', 'classification')
          returning id into coverage_id;
        insert into public.fiscal_data_coverage_source_occurrences (
          coverage_id, fiscal_year, reporting_scope_id,
          source_kind, data_kind, edition_source_occurrence_id,
          edition_id, ingestion_source_id, source_coverage_key
        ) values (
          coverage_id, 2088, scope_id, 'budget_overview',
          'classification',
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001', 'classifications'
        ) returning id into coverage_occurrence_id;
        insert into public.fiscal_data_coverage_observations (
          coverage_id, fiscal_year, reporting_scope_id,
          source_kind, data_kind, observation_key, state,
          record_presence, expected_count, matched_count
        ) values (
          coverage_id, 2088, scope_id, 'budget_overview',
          'classification', 'fixture', 'collected', 'present', 1, 1
        ) returning id into coverage_observation_id;
        insert into public.fiscal_data_coverage_observation_sources (
          observation_id, coverage_id, fiscal_year, reporting_scope_id,
          source_kind, data_kind, coverage_source_occurrence_id,
          edition_source_occurrence_id, edition_observation_id,
          edition_id, ingestion_source_id, source_version_id,
          evidence_role, observed_presence, source_locator,
          extraction_method, qa_status, verified_by, verified_at
        ) values (
          coverage_observation_id, coverage_id, 2088, scope_id,
          'budget_overview', 'classification', coverage_occurrence_id,
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000006',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000002',
          'primary', 'present', 'page=1', 'manual', 'verified',
          '10000000-0000-0000-0000-000000000099', now()
        );

        insert into public.fiscal_classifications (
          scheme, canonical_key
        ) values ('purpose', 'assembly') returning id into classification_id;
        insert into public.fiscal_classification_revisions (
          classification_id, scheme, revision_number, display_label,
          valid_from_fiscal_year
        ) values (
          classification_id, 'purpose', 1, '議会費', 2088
        ) returning id into classification_revision_id;
        insert into public.fiscal_classification_source_occurrences (
          classification_id, scheme, edition_source_occurrence_id,
          edition_id, ingestion_source_id, source_classification_key
        ) values (
          classification_id, 'purpose',
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001', 'purpose:assembly'
        ) returning id into classification_occurrence_id;
        insert into public.fiscal_classification_sources (
          classification_revision_id, classification_id, scheme,
          classification_source_occurrence_id,
          edition_source_occurrence_id, edition_observation_id,
          edition_id, ingestion_source_id, source_version_id,
          source_label, observed_fiscal_year, source_locator,
          extraction_method, qa_status, verified_by, verified_at
        ) values (
          classification_revision_id, classification_id, 'purpose',
          classification_occurrence_id,
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000006',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000002',
          '議会費', 2088, 'page=1', 'manual', 'verified',
          '10000000-0000-0000-0000-000000000099', now()
        );

        insert into public.fiscal_classification_mappings (
          scheme, mapping_key
        ) values ('purpose', 'assembly-2088') returning id into mapping_id;
        insert into public.fiscal_classification_mapping_revisions (
          mapping_id, scheme, revision_number, relation_kind,
          effective_fiscal_year
        ) values (mapping_id, 'purpose', 1, 'equivalent', 2088)
          returning id into mapping_revision_id;
        insert into public.fiscal_classification_mapping_members (
          mapping_revision_id, mapping_id, scheme,
          classification_id, direction, member_order
        ) values
          (mapping_revision_id, mapping_id, 'purpose',
            classification_id, 'from', 1),
          (mapping_revision_id, mapping_id, 'purpose',
            classification_id, 'to', 1);
        insert into public.fiscal_classification_mapping_source_occurrences (
          mapping_id, scheme, edition_source_occurrence_id,
          edition_id, ingestion_source_id, source_mapping_key
        ) values (
          mapping_id, 'purpose',
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001', 'mapping:assembly'
        ) returning id into mapping_occurrence_id;
        insert into public.fiscal_classification_mapping_sources (
          mapping_revision_id, mapping_id, scheme,
          mapping_source_occurrence_id, edition_source_occurrence_id,
          edition_observation_id, edition_id, ingestion_source_id,
          source_version_id, source_locator, observed_mapping_text,
          extraction_method, qa_status, verified_by, verified_at
        ) values (
          mapping_revision_id, mapping_id, 'purpose', mapping_occurrence_id,
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000006',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000002',
          'page=1', '議会費は年度間で同等', 'manual', 'verified',
          '10000000-0000-0000-0000-000000000099', now()
        );

        insert into public.fiscal_events (
          fiscal_year, reporting_scope_id, event_kind
        ) values (2088, scope_id, 'initial_budget') returning id into event_id;
        insert into public.fiscal_event_bill_links (
          fiscal_event_id, link_key
        ) values (event_id, 'initial-budget-bill') returning id into link_id;
        insert into public.bills (id, name, status, publish_status)
        values (
          '10000000-0000-0000-0000-000000000020',
          '令和70年度一般会計予算案', 'submitted', 'draft'
        );
        insert into public.fiscal_event_bill_link_revisions (
          link_id, fiscal_event_id, revision_number, bill_id,
          relationship, match_method, evidence_summary
        ) values (
          link_id, event_id, 1,
          '10000000-0000-0000-0000-000000000020',
          'proposes', 'exact_fields', '年度と議案番号が一致'
        ) returning id into link_revision_id;
        insert into public.fiscal_event_bill_link_source_occurrences (
          link_id, fiscal_event_id, edition_source_occurrence_id,
          edition_id, ingestion_source_id, source_relation_key
        ) values (
          link_id, event_id,
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001', 'bill:fixture'
        ) returning id into link_occurrence_id;
        insert into public.fiscal_event_bill_link_sources (
          link_revision_id, link_id, fiscal_event_id,
          link_source_occurrence_id, edition_source_occurrence_id,
          edition_observation_id, edition_id, ingestion_source_id,
          source_version_id, raw_bill_number, raw_relationship,
          source_locator, extraction_method, qa_status,
          verified_by, verified_at
        ) values (
          link_revision_id, link_id, event_id, link_occurrence_id,
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000006',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000002',
          '議第1号', '提出', 'page=1', 'manual', 'verified',
          '10000000-0000-0000-0000-000000000099', now()
        );
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });

  it("別正本や別schemeへの根拠付け替えを複合FKで拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      ${fiscalEvidenceFixtureSql}
      do $$
      declare
        first_classification_id uuid;
        second_classification_id uuid;
        second_revision_id uuid;
        occurrence_id uuid;
      begin
        insert into public.fiscal_classifications (scheme, canonical_key)
        values ('purpose', 'first') returning id into first_classification_id;
        insert into public.fiscal_classifications (scheme, canonical_key)
        values ('purpose', 'second') returning id into second_classification_id;
        insert into public.fiscal_classification_revisions (
          classification_id, scheme, revision_number, display_label,
          valid_from_fiscal_year
        ) values (
          second_classification_id, 'purpose', 1, '別分類', 2088
        ) returning id into second_revision_id;
        insert into public.fiscal_classification_source_occurrences (
          classification_id, scheme, edition_source_occurrence_id,
          edition_id, ingestion_source_id, source_classification_key
        ) values (
          first_classification_id, 'purpose',
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000001', 'purpose:first'
        ) returning id into occurrence_id;

        begin
          insert into public.fiscal_classification_sources (
            classification_revision_id, classification_id, scheme,
            classification_source_occurrence_id,
            edition_source_occurrence_id, edition_observation_id,
            edition_id, ingestion_source_id, source_version_id,
            source_label, observed_fiscal_year, source_locator,
            extraction_method
          ) values (
            second_revision_id, second_classification_id, 'purpose',
            occurrence_id,
            '10000000-0000-0000-0000-000000000005',
            '10000000-0000-0000-0000-000000000006',
            '10000000-0000-0000-0000-000000000004',
            '10000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000002',
            '別分類', 2088, 'page=1', 'manual'
          );
          raise exception 'cross-target evidence unexpectedly succeeded';
        exception
          when foreign_key_violation then null;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });
});
