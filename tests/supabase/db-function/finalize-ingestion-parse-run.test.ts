import { describe, expect, it } from "vitest";
import { adminClient } from "../utils";

async function createParseRun() {
  const uniqueKey = `${Date.now()}-${crypto.randomUUID()}`;
  const { data: source, error: sourceError } = await adminClient
    .from("ingestion_sources")
    .insert({
      source: "general_question_pdf_test",
      url: `https://example.com/general-questions/${uniqueKey}.pdf`,
    })
    .select("id")
    .single();
  if (sourceError) throw new Error(sourceError.message);

  const { data: version, error: versionError } = await adminClient
    .from("ingestion_source_versions")
    .insert({
      ingestion_source_id: source.id,
      content_hash: `sha256:${uniqueKey}`,
      fetched_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);

  const { data: ingestionRun, error: ingestionRunError } = await adminClient
    .from("ingestion_runs")
    .insert({ source: "general_question_pdf_test" })
    .select("id")
    .single();
  if (ingestionRunError) throw new Error(ingestionRunError.message);

  const { data: parseRun, error: parseRunError } = await adminClient
    .from("ingestion_parse_runs")
    .insert({
      ingestion_run_id: ingestionRun.id,
      source_version_id: version.id,
      parser_name: "general-question-pdf",
      parser_version: "test-v1",
      configuration_hash: `config:${uniqueKey}`,
    })
    .select("id, status, finished_at, parse_stats")
    .single();
  if (parseRunError) throw new Error(parseRunError.message);

  return parseRun;
}

describe("finalize_ingestion_parse_run()", () => {
  it("runningの解析実行を一度だけcompletedへ確定する", async () => {
    const parseRun = await createParseRun();
    expect(parseRun.status).toBe("running");
    expect(parseRun.finished_at).toBeNull();

    const finishedAt = new Date(Date.now() + 1000).toISOString();
    const { error } = await adminClient.rpc("finalize_ingestion_parse_run", {
      p_parse_run_id: parseRun.id,
      p_status: "completed",
      p_parse_stats: { appearanceCount: 3 },
      p_finished_at: finishedAt,
    });
    expect(error).toBeNull();

    const { data: finalized, error: selectError } = await adminClient
      .from("ingestion_parse_runs")
      .select("status, finished_at, parse_stats")
      .eq("id", parseRun.id)
      .single();
    expect(selectError).toBeNull();
    expect(finalized?.status).toBe("completed");
    expect(new Date(finalized?.finished_at ?? 0).getTime()).toBe(
      new Date(finishedAt).getTime()
    );
    expect(finalized?.parse_stats).toEqual({ appearanceCount: 3 });

    const secondFinalize = await adminClient.rpc(
      "finalize_ingestion_parse_run",
      {
        p_parse_run_id: parseRun.id,
        p_status: "failed",
        p_parse_stats: { reason: "late update" },
        p_finished_at: new Date(Date.now() + 2000).toISOString(),
      }
    );
    expect(secondFinalize.error?.message).toContain("was not running");
  });

  it("終端状態での直接INSERTを拒否する", async () => {
    const running = await createParseRun();
    const { data: existing, error: selectError } = await adminClient
      .from("ingestion_parse_runs")
      .select("ingestion_run_id, source_version_id")
      .eq("id", running.id)
      .single();
    if (selectError) throw new Error(selectError.message);

    const { error } = await adminClient.from("ingestion_parse_runs").insert({
      ingestion_run_id: existing.ingestion_run_id,
      source_version_id: existing.source_version_id,
      parser_name: "invalid-terminal-insert",
      parser_version: "test-v1",
      configuration_hash: crypto.randomUUID(),
      status: "completed",
      finished_at: new Date().toISOString(),
    });
    expect(error?.message).toContain("must be inserted as running");
  });
});
