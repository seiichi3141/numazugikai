import { readFileSync } from "node:fs";
import postgres from "postgres";

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
        create table council_sessions (
          id integer primary key,
          slug text
        );
        create table bills (
          id integer primary key,
          council_session_id integer references council_sessions(id),
          bill_number text,
          bill_number_kind bill_number_kind_enum,
          bill_number_value integer,
          submitter bill_submitter_enum,
          source_url text,
          constraint bills_session_bill_number_key
            unique (council_session_id, bill_number)
        );
      `);
      await transaction.unsafe(`
        insert into council_sessions (id, slug) values
          (1, '2026-13'),
          (2, ' 2026-13 '),
          (3, null);

        insert into bills (
          id,
          council_session_id,
          bill_number,
          bill_number_kind,
          bill_number_value,
          submitter,
          source_url
        ) values
          (1, 1, '議第58号', 'gi', 58, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (2, 1, '発議第1号', 'hatsugi', 1, null,
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (3, 1, '発議第2号', 'hatsugi', 2, 'committee',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (4, 1, '議第1号', 'gi', 1, null,
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (5, 1, '報第14号', 'hou', 14, 'mayor',
            'https://example.com/not-numazu-official'),
          (6, 2, '議第2号', 'gi', 2, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (7, 3, '議第3号', 'gi', 3, 'mayor',
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm'),
          (8, 1, '請願第1号', 'seigan', 1, null,
            'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25.htm');
      `);

      await transaction.unsafe(migrationSql);

      const rows = await transaction<
        { id: number; source_record_key: string | null }[]
      >`
        select id, source_record_key
        from bills
        order by id
      `;

      expect(rows).toEqual([
        {
          id: 1,
          source_record_key:
            "numazu-city:2026-13:executive_bill:mayor:numbered:gi-58",
        },
        {
          id: 2,
          source_record_key:
            "numazu-city:2026-13:member_bill:member:numbered:hatsugi-1",
        },
        {
          id: 3,
          source_record_key:
            "numazu-city:2026-13:committee_bill:committee:numbered:hatsugi-2",
        },
        { id: 4, source_record_key: null },
        { id: 5, source_record_key: null },
        { id: 6, source_record_key: null },
        { id: 7, source_record_key: null },
        {
          id: 8,
          source_record_key:
            "numazu-city:2026-13:petition:citizen:numbered:seigan-1",
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
