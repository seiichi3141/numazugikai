import { readFileSync } from "node:fs";
import postgres from "postgres";
import { buildNumazuBillSourceRecordKey } from "../../../packages/numazu-ingest/src/utils/build-numazu-bill-source-record-key";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54432/postgres";
const migrationSql = readFileSync(
  new URL(
    "../../../supabase/migrations/20260904010000_add_bill_source_record_key.sql",
    import.meta.url
  ),
  "utf8"
);
const functionMigrationSql = readFileSync(
  new URL(
    "../../../supabase/migrations/20260904011000_add_upsert_ingested_bill.sql",
    import.meta.url
  ),
  "utf8"
);

describe("add_bill_source_record_key migration", () => {
  const sql = postgres(databaseUrl, { max: 1 });
  const schemaName = `source_key_migration_test_${process.pid}`;
  const quotedSchemaName = `"${schemaName}"`;

  afterAll(async () => {
    await sql.unsafe(`drop schema if exists ${quotedSchemaName} cascade`);
    await sql.end();
  });

  it("実マイグレーションが安全な沼津recordだけをbackfillする", async () => {
    await sql.unsafe(`drop schema if exists ${quotedSchemaName} cascade`);

    await sql.begin(async (transaction) => {
      await transaction.unsafe(`create schema ${quotedSchemaName}`);
      await transaction.unsafe(
        `set local search_path to ${quotedSchemaName}, public`
      );
      await transaction.unsafe(`
        create type bill_number_kind_enum as enum (
          'gi', 'hou', 'nin', 'hatsugi', 'seigan', 'chinjo'
        );
        create type bill_submitter_enum as enum (
          'mayor', 'member', 'committee', 'citizen'
        );
        create type bill_category_enum as enum ('other');
        create type bill_status_enum as enum ('submitted');
        create table council_sessions (
          id uuid primary key,
          slug text
        );
        create table bills (
          id uuid primary key default gen_random_uuid(),
          test_case integer,
          council_session_id uuid references council_sessions(id),
          bill_number text,
          bill_number_kind bill_number_kind_enum,
          bill_number_value integer,
          name text,
          category bill_category_enum,
          legal_basis text,
          submitted_date date,
          submitter bill_submitter_enum,
          committee_id uuid,
          committee_result text,
          decided_on date,
          status bill_status_enum default 'submitted',
          status_note text,
          source_url text,
          document_url text,
          constraint bills_session_bill_number_key
            unique (council_session_id, bill_number)
        );
      `);
      await transaction.unsafe(`
        insert into council_sessions (id, slug) values
          ('00000000-0000-0000-0000-000000000001', '2026-13'),
          ('00000000-0000-0000-0000-000000000002', ' 2026-13 '),
          ('00000000-0000-0000-0000-000000000003', null);

        insert into bills (
          test_case,
          council_session_id,
          bill_number,
          bill_number_kind,
          bill_number_value,
          submitter,
          source_url
        ) values
          (1, '00000000-0000-0000-0000-000000000001', '議第58号', 'gi', 58, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (2, '00000000-0000-0000-0000-000000000001', '発議第1号', 'hatsugi', 1, null,
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (3, '00000000-0000-0000-0000-000000000001', '発議第2号', 'hatsugi', 2, 'committee',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (4, '00000000-0000-0000-0000-000000000001', '議第1号', 'gi', 1, null,
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (5, '00000000-0000-0000-0000-000000000001', '報第14号', 'hou', 14, 'mayor',
            'https://example.com/not-numazu-official'),
          (6, '00000000-0000-0000-0000-000000000002', '議第2号', 'gi', 2, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (7, '00000000-0000-0000-0000-000000000003', '議第3号', 'gi', 3, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (8, '00000000-0000-0000-0000-000000000001', '請願第1号', 'seigan', 1, null,
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (9, '00000000-0000-0000-0000-000000000001', '報第15号', 'hou', 15, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (10, '00000000-0000-0000-0000-000000000001', '議第59号', 'gi', 59, 'member',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (11, '00000000-0000-0000-0000-000000000001', '陳情第1号', 'chinjo', 1, null,
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (12, '00000000-0000-0000-0000-000000000001', '認第1号', 'nin', 1, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm');
      `);

      await transaction.unsafe(migrationSql);
      await transaction.unsafe(functionMigrationSql);

      const rows = await transaction<
        { test_case: number; source_record_key: string | null }[]
      >`
        select test_case, source_record_key
        from bills
        where test_case is not null
        order by test_case
      `;

      expect(rows).toEqual([
        {
          test_case: 1,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "gi",
            numberValue: 58,
            submitter: "mayor",
          }),
        },
        {
          test_case: 2,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "hatsugi",
            numberValue: 1,
            submitter: null,
          }),
        },
        {
          test_case: 3,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "hatsugi",
            numberValue: 2,
            submitter: "committee",
          }),
        },
        { test_case: 4, source_record_key: null },
        { test_case: 5, source_record_key: null },
        { test_case: 6, source_record_key: null },
        { test_case: 7, source_record_key: null },
        {
          test_case: 8,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "seigan",
            numberValue: 1,
            submitter: null,
          }),
        },
        {
          test_case: 9,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "hou",
            numberValue: 15,
            submitter: "mayor",
          }),
        },
        {
          test_case: 10,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "gi",
            numberValue: 59,
            submitter: "member",
          }),
        },
        {
          test_case: 11,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "chinjo",
            numberValue: 1,
            submitter: null,
          }),
        },
        {
          test_case: 12,
          source_record_key: buildNumazuBillSourceRecordKey({
            sessionSlug: "2026-13",
            numberKind: "nin",
            numberValue: 1,
            submitter: "mayor",
          }),
        },
      ]);

      const constraints = await transaction<{ constraint_name: string }[]>`
        select constraint_name
        from information_schema.table_constraints
        where table_schema = ${schemaName}
          and table_name = 'bills'
          and constraint_type = 'UNIQUE'
        order by constraint_name
      `;
      expect(constraints.map(({ constraint_name }) => constraint_name)).toEqual(
        ["bills_session_bill_number_key", "bills_source_record_key_key"]
      );

      const [column] = await transaction<{ is_nullable: "YES" | "NO" }[]>`
        select is_nullable
        from information_schema.columns
        where table_schema = ${schemaName}
          and table_name = 'bills'
          and column_name = 'source_record_key'
      `;
      expect(column?.is_nullable).toBe("YES");

      await transaction.unsafe("set local search_path to public");
      await transaction.unsafe(`drop schema ${quotedSchemaName} cascade`);
    });
  });
});
