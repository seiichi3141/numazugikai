import { describe, expect, it } from "vitest";
import { adminClient } from "../utils";

async function createSourceVersion() {
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
  return version;
}

describe("transition_ingestion_source_version_retention()", () => {
  it("保持状態を監査履歴付きでretainedへ遷移する", async () => {
    const version = await createSourceVersion();
    const changedBy = crypto.randomUUID();
    const availableUntil = "2027-09-03T00:00:00.000Z";
    const { error } = await adminClient.rpc(
      "transition_ingestion_source_version_retention",
      {
        p_source_version_id: version.id,
        p_to_state: "retained",
        p_changed_by: changedBy,
        p_reason: "一般質問PDFの再解析可能性を確保するため",
        p_private_object_key: `general-questions/${version.id}.pdf`,
        p_reparse_available_until: availableUntil,
      }
    );
    expect(error).toBeNull();

    const { data: retained, error: retainedError } = await adminClient
      .from("ingestion_source_versions")
      .select(
        "artifact_retention_state, private_object_key, reparse_available_until"
      )
      .eq("id", version.id)
      .single();
    expect(retainedError).toBeNull();
    expect(retained?.artifact_retention_state).toBe("retained");
    expect(retained?.private_object_key).toBe(
      `general-questions/${version.id}.pdf`
    );
    expect(new Date(retained?.reparse_available_until ?? 0).getTime()).toBe(
      new Date(availableUntil).getTime()
    );

    const { data: transitions, error: transitionsError } = await adminClient
      .from("ingestion_source_version_retention_transitions")
      .select("from_state, to_state, changed_by, reason")
      .eq("source_version_id", version.id);
    expect(transitionsError).toBeNull();
    expect(transitions).toEqual([
      {
        from_state: "pending",
        to_state: "retained",
        changed_by: changedBy,
        reason: "一般質問PDFの再解析可能性を確保するため",
      },
    ]);
  });

  it("実行者または理由のない遷移を拒否する", async () => {
    const version = await createSourceVersion();
    const { error } = await adminClient.rpc(
      "transition_ingestion_source_version_retention",
      {
        p_source_version_id: version.id,
        p_to_state: "expired",
        p_changed_by: crypto.randomUUID(),
        p_reason: "   ",
      }
    );
    expect(error?.message).toContain("requires actor and reason");
  });
});
