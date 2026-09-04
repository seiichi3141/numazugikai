import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import {
  fiscalClassificationFixtureSql,
  fiscalParserEditionFixtureSql,
  publishFiscalClassificationSql,
  publishFiscalParserEditionSql,
} from "./fiscal-publication-test-fixture";

describe("enforce_fiscal_draft_child_mutation()", () => {
  it("source_parse検算はamount set親なしで状態更新できる", () => {
    const output = executeInTestDatabase(`
      begin;
      insert into public.ingestion_sources (id, source, url) values (
        '21000000-0000-0000-0000-000000000001',
        'fiscal_source_parse_test', 'https://example.com/source-parse.pdf'
      );
      insert into public.ingestion_source_versions (
        id, ingestion_source_id, content_hash, fetched_at
      ) values (
        '21000000-0000-0000-0000-000000000002',
        '21000000-0000-0000-0000-000000000001',
        'sha256:fiscal-source-parse-test', now()
      );
      insert into public.ingestion_runs (id, source) values (
        '21000000-0000-0000-0000-000000000003',
        'fiscal_source_parse_test'
      );
      insert into public.ingestion_parse_runs (
        id, ingestion_run_id, source_version_id, parser_name,
        parser_version, configuration_hash
      ) values (
        '21000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000003',
        '21000000-0000-0000-0000-000000000002',
        'source-parse-test', '1.0.0', 'sha256:source-parse-test'
      );
      insert into public.fiscal_validation_results (
        id, validation_scope, parse_run_id, source_version_id,
        rule_code, severity
      ) values (
        '21000000-0000-0000-0000-000000000005', 'source_parse',
        '21000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000002',
        'source-shape', 'hard_error'
      );
      update public.fiscal_validation_results
      set status = 'passed'
      where id = '21000000-0000-0000-0000-000000000005';
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });

  it("reviewed以降の親へ根拠を追加できない", () => {
    expect(() =>
      executeInTestDatabase(`
        begin;
        ${fiscalParserEditionFixtureSql}
        ${publishFiscalParserEditionSql}
        ${fiscalClassificationFixtureSql}
        ${publishFiscalClassificationSql}
        insert into public.fiscal_classification_sources (
          classification_revision_id, classification_id, scheme,
          classification_source_occurrence_id,
          edition_source_occurrence_id, edition_observation_id,
          edition_id, ingestion_source_id, source_version_id,
          parse_run_id, evidence_revision, source_label,
          observed_fiscal_year, extraction_method
        ) values (
          '20000000-0000-0000-0000-000000000011',
          '20000000-0000-0000-0000-000000000010', 'purpose',
          '20000000-0000-0000-0000-000000000012',
          '20000000-0000-0000-0000-000000000007',
          '20000000-0000-0000-0000-000000000008',
          '20000000-0000-0000-0000-000000000006',
          '20000000-0000-0000-0000-000000000001',
          '20000000-0000-0000-0000-000000000002',
          '20000000-0000-0000-0000-000000000004',
          2, '追記', 2090, 'parser'
        );
      `)
    ).toThrow(/requires a draft fiscal parent/);
  });
});
