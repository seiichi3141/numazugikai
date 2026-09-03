import type { Database } from "@mirai-gikai/supabase";
import { createAdminClient } from "@mirai-gikai/supabase";
import type { BillCategory } from "../shared/types";

type BillStatus = Database["public"]["Enums"]["bill_status_enum"];

export type CouncilSessionUpsert = {
  name: string;
  slug: string;
  sessionNumber: number;
  kind: "regular" | "extraordinary";
  startDate: string;
  endDate: string;
  sourceUrl: string | null;
  externalCouncilId?: string | null;
};

export type BillUpsert = {
  councilSessionId: string;
  sourceRecordKey: string | null;
  billNumber: string;
  numberKind: Database["public"]["Enums"]["bill_number_kind_enum"];
  numberValue: number;
  name: string;
  category: BillCategory;
  legalBasis: string | null;
  submittedOn: string | null;
  submitter: Database["public"]["Enums"]["bill_submitter_enum"] | null;
  committeeId: string | null;
  committeeResult: string | null;
  decidedOn: string | null;
  status: BillStatus;
  statusNote: string | null;
  sourceUrl: string;
  documentUrl: string | null;
};

/** 会期を slug で突合して作成・更新する。 */
export async function upsertCouncilSession(
  session: CouncilSessionUpsert
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("council_sessions")
    .upsert(
      {
        name: session.name,
        slug: session.slug,
        session_number: session.sessionNumber,
        kind: session.kind,
        start_date: session.startDate,
        end_date: session.endDate,
        source_url: session.sourceUrl,
        ...(session.externalCouncilId === undefined
          ? {}
          : { external_council_id: session.externalCouncilId }),
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`会期の保存に失敗した: ${error.message}`);
  return data.id;
}

/**
 * 会期が無ければ作り、あればそのIDを返す。
 *
 * 会期の正確な日付は会期予定ページが持っている。議案審議結果PDFから逆算した
 * 日付でそれを潰さないよう、既存値は原則として上書きしない。
 * `replaceExistingSourceUrl` を指定した場合だけ、そのURLを出典とする暫定会期を
 * 今回の値へ置換する。
 */
export async function ensureCouncilSession(
  session: CouncilSessionUpsert,
  options: { replaceExistingSourceUrl?: string } = {}
): Promise<string> {
  const supabase = createAdminClient();
  const { data: existing, error } = await supabase
    .from("council_sessions")
    .select("id, source_url")
    .eq("slug", session.slug)
    .maybeSingle();
  if (error) throw new Error(`会期の取得に失敗した: ${error.message}`);
  if (existing) {
    if (
      options.replaceExistingSourceUrl === undefined ||
      existing.source_url !== options.replaceExistingSourceUrl ||
      session.sourceUrl === options.replaceExistingSourceUrl
    ) {
      return existing.id;
    }

    // 開会中ページから作った暫定会期だけを、後続のより詳しいソースで置換する。
    // 条件付き更新にして、同時に会期予定ページが正式値を保存した場合は上書きしない。
    const { data: replaced, error: replaceError } = await supabase
      .from("council_sessions")
      .update({
        name: session.name,
        session_number: session.sessionNumber,
        kind: session.kind,
        start_date: session.startDate,
        end_date: session.endDate,
        source_url: session.sourceUrl,
        ...(session.externalCouncilId === undefined
          ? {}
          : { external_council_id: session.externalCouncilId }),
      })
      .eq("id", existing.id)
      .eq("source_url", options.replaceExistingSourceUrl)
      .select("id")
      .maybeSingle();
    if (replaceError) {
      throw new Error(`暫定会期の更新に失敗した: ${replaceError.message}`);
    }
    return replaced?.id ?? existing.id;
  }

  return upsertCouncilSession(session);
}

/**
 * 委員会を略称で突合して作成・更新する。
 *
 * 委員会の名称は期ごとの再編で変わる（令和6年の「総務」→ 令和8年の「総務経済」）ため、
 * 既知の一覧を持たず、PDFに現れた略称をそのまま登録する。
 */
export async function upsertCommittee(shortName: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("committees")
    .upsert(
      {
        short_name: shortName,
        name: shortName.endsWith("委員会") ? shortName : `${shortName}委員会`,
      },
      { onConflict: "short_name", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error) throw new Error(`委員会の保存に失敗した: ${error.message}`);
  return data.id;
}

/**
 * 結果PDFの完全な解析結果を、会期IDと議案番号で突合して作成・更新する。
 * nullable項目も解析結果を正として置換するため、部分情報の保存には使用しない。
 */
export async function upsertBill(bill: BillUpsert): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("upsert_ingested_bill", {
    p_bill_number: bill.billNumber,
    p_category: bill.category,
    p_council_session_id: bill.councilSessionId,
    p_name: bill.name,
    p_number_kind: bill.numberKind,
    p_number_value: bill.numberValue,
    p_source_url: bill.sourceUrl,
    p_status: bill.status,
    ...(bill.sourceRecordKey === null
      ? {}
      : { p_source_record_key: bill.sourceRecordKey }),
    ...(bill.legalBasis === null ? {} : { p_legal_basis: bill.legalBasis }),
    ...(bill.submittedOn === null ? {} : { p_submitted_on: bill.submittedOn }),
    ...(bill.submitter === null ? {} : { p_submitter: bill.submitter }),
    ...(bill.committeeId === null ? {} : { p_committee_id: bill.committeeId }),
    ...(bill.committeeResult === null
      ? {}
      : { p_committee_result: bill.committeeResult }),
    ...(bill.decidedOn === null ? {} : { p_decided_on: bill.decidedOn }),
    ...(bill.statusNote === null ? {} : { p_status_note: bill.statusNote }),
    ...(bill.documentUrl === null ? {} : { p_document_url: bill.documentUrl }),
  });

  if (error) {
    const diagnostic = [error.details, error.hint].filter(Boolean).join(" / ");
    throw new Error(
      `議案の保存に失敗した: ${error.message}${diagnostic ? ` (${diagnostic})` : ""}`
    );
  }
  return data;
}

export type CurrentSessionBillUpsert = {
  councilSessionId: string;
  sourceRecordKey: string | null;
  billNumber: string;
  numberKind: Database["public"]["Enums"]["bill_number_kind_enum"];
  numberValue: number;
  name: string;
  category: BillCategory;
  submittedOn: string | null;
  defaultSubmittedOn: string;
  submitter: Database["public"]["Enums"]["bill_submitter_enum"] | null;
  sourceUrl: string;
  documentUrl: string | null;
};

/**
 * 開会中ページの提出議案を保存する。
 *
 * 既存行は閉会後の結果PDFから得た委員会・議決結果を持つ可能性があるため、
 * 開会中ページに存在する項目だけを更新し、それ以外をnullへ戻さない。
 */
export async function upsertCurrentSessionBill(
  bill: CurrentSessionBillUpsert
): Promise<{ id: string; created: boolean }> {
  const supabase = createAdminClient();
  const { data: existing, error: findError } = await supabase
    .from("bills")
    .select("id, source_record_key, source_url")
    .eq("council_session_id", bill.councilSessionId)
    .eq("bill_number", bill.billNumber)
    .maybeSingle();

  if (findError) {
    throw new Error(`議案の検索に失敗した: ${findError.message}`);
  }

  const updateExisting = async (
    id: string,
    sourceRecordKey: string | null,
    sourceUrl: string | null
  ): Promise<{ id: string; created: false }> => {
    const incomingSourceRecordKey = bill.sourceRecordKey;
    if (
      sourceRecordKey !== null &&
      incomingSourceRecordKey !== null &&
      sourceRecordKey !== incomingSourceRecordKey
    ) {
      throw new Error(
        `議案の永続identityが一致しません: bill_number=${bill.billNumber}, existing_source_record_key=${sourceRecordKey}, incoming_source_record_key=${incomingSourceRecordKey}`
      );
    }
    const updates: Database["public"]["Tables"]["bills"]["Update"] = {
      name: bill.name,
    };
    if (bill.documentUrl) updates.document_url = bill.documentUrl;
    const promotesSourceRecordKey =
      sourceRecordKey === null && incomingSourceRecordKey !== null;
    if (promotesSourceRecordKey) {
      updates.source_record_key = incomingSourceRecordKey;
    }
    let updateQuery = supabase.from("bills").update(updates).eq("id", id);
    if (promotesSourceRecordKey) {
      updateQuery = updateQuery.is("source_record_key", null);
    }
    const { data: updated, error } = await updateQuery
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`議案の更新に失敗した: ${error.message}`);
    if (!updated) {
      if (!promotesSourceRecordKey) {
        throw new Error(`議案の更新対象を確認できませんでした: ${id}`);
      }
      const { data: latest, error: refetchError } = await supabase
        .from("bills")
        .select("source_record_key")
        .eq("id", id)
        .single();
      if (refetchError) {
        throw new Error(`議案の再検索に失敗した: ${refetchError.message}`);
      }
      if (latest.source_record_key !== incomingSourceRecordKey) {
        throw new Error(
          `議案の永続identityが一致しません: bill_number=${bill.billNumber}, existing_source_record_key=${latest.source_record_key}, incoming_source_record_key=${incomingSourceRecordKey}`
        );
      }
      const retryUpdates: Database["public"]["Tables"]["bills"]["Update"] = {
        name: bill.name,
      };
      if (bill.documentUrl) retryUpdates.document_url = bill.documentUrl;
      const { data: retried, error: retryError } = await supabase
        .from("bills")
        .update(retryUpdates)
        .eq("id", id)
        .eq("source_record_key", incomingSourceRecordKey)
        .select("id")
        .maybeSingle();
      if (retryError) {
        throw new Error(`議案の更新再試行に失敗した: ${retryError.message}`);
      }
      if (!retried) {
        throw new Error(`議案の更新再試行で対象を確認できませんでした: ${id}`);
      }
    }

    if (sourceUrl === bill.sourceUrl) {
      // 同じ開会中ページから作成した暫定行だけ、後から掲載・訂正された値へ追従する。
      // source_urlを更新条件にも含め、結果PDFの保存が同時に走っても確定値を降格させない。
      const { error: metadataError } = await supabase
        .from("bills")
        .update({
          category: bill.category,
          ...(bill.submittedOn === null
            ? {}
            : { submitted_date: bill.submittedOn }),
        })
        .eq("id", id)
        .eq("source_url", bill.sourceUrl);
      if (metadataError) {
        throw new Error(
          `議案の暫定情報更新に失敗した: ${metadataError.message}`
        );
      }
    }
    return { id, created: false };
  };

  if (existing) {
    return updateExisting(
      existing.id,
      existing.source_record_key,
      existing.source_url
    );
  }

  const { data, error } = await supabase
    .from("bills")
    .insert({
      council_session_id: bill.councilSessionId,
      source_record_key: bill.sourceRecordKey,
      bill_number: bill.billNumber,
      bill_number_kind: bill.numberKind,
      bill_number_value: bill.numberValue,
      name: bill.name,
      category: bill.category,
      submitted_date: bill.submittedOn ?? bill.defaultSubmittedOn,
      submitter: bill.submitter,
      status: "submitted",
      source_url: bill.sourceUrl,
      document_url: bill.documentUrl,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: concurrent } = await supabase
      .from("bills")
      .select("id, source_record_key, source_url")
      .eq("council_session_id", bill.councilSessionId)
      .eq("bill_number", bill.billNumber)
      .single();
    if (concurrent) {
      return updateExisting(
        concurrent.id,
        concurrent.source_record_key,
        concurrent.source_url
      );
    }
  }
  if (error) throw new Error(`議案の保存に失敗した: ${error.message}`);
  return { id: data.id, created: true };
}

/** 議案本文PDFのリンクだけを後から埋める。 */
export async function updateBillDocumentUrl(
  billId: string,
  documentUrl: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bills")
    .update({ document_url: documentUrl })
    .eq("id", billId);
  if (error) throw new Error(`議案本文URLの保存に失敗した: ${error.message}`);
}

export async function upsertFaction(faction: {
  name: string;
  externalGroupId: string | null;
  memberCount: number | null;
  displayOrder: number;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("factions")
    .upsert(
      {
        name: faction.name,
        external_group_id: faction.externalGroupId,
        member_count: faction.memberCount,
        display_order: faction.displayOrder,
      },
      { onConflict: "name" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`会派の保存に失敗した: ${error.message}`);
  return data.id;
}

/**
 * 議員を議会中継システムの speaker_id で突合して作成・更新する。
 *
 * 電話番号・自宅住所は公開されているが、本サービスでは扱わない。
 */
export async function upsertCouncilMember(member: {
  name: string;
  nameKana: string | null;
  externalSpeakerId: string;
  factionId: string | null;
  photoUrl: string | null;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("council_members")
    .upsert(
      {
        name: member.name,
        name_kana: member.nameKana,
        external_speaker_id: member.externalSpeakerId,
        faction_id: member.factionId,
        photo_url: member.photoUrl,
      },
      { onConflict: "external_speaker_id" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`議員の保存に失敗した: ${error.message}`);
  return data.id;
}

/** 会期の slug から議案IDを引く（議案本文リンクの突合に使う）。 */
export async function findBillIdsBySession(
  councilSessionId: string
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select("id, bill_number")
    .eq("council_session_id", councilSessionId);

  if (error) throw new Error(`議案の取得に失敗した: ${error.message}`);
  return new Map(
    (data ?? [])
      .filter((row): row is { id: string; bill_number: string } =>
        Boolean(row.bill_number)
      )
      .map((row) => [row.bill_number, row.id])
  );
}

// ---------------------------------------------------------------
// 取り込みの記録・差分検知
// ---------------------------------------------------------------

export async function startIngestionRun(source: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ingestion_runs")
    .insert({ source, status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(`取り込み記録の作成に失敗した: ${error.message}`);
  return data.id;
}

export async function finishIngestionRun(
  runId: string,
  result: { status: "completed" | "failed"; stats?: unknown; error?: string }
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("ingestion_runs")
    .update({
      status: result.status,
      finished_at: new Date().toISOString(),
      stats: (result.stats ?? null) as never,
      error: result.error ?? null,
    })
    .eq("id", runId);
}

/** 前回取得時の内容ハッシュを返す。未取得なら null。 */
export async function findContentHash(
  source: string,
  url: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ingestion_sources")
    .select("content_hash")
    .eq("source", source)
    .eq("url", url)
    .maybeSingle();
  return data?.content_hash ?? null;
}

export async function saveContentHash(record: {
  source: string;
  url: string;
  contentHash: string;
  etag: string | null;
  lastModified: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ingestion_sources").upsert(
    {
      source: record.source,
      url: record.url,
      content_hash: record.contentHash,
      etag: record.etag,
      last_modified: record.lastModified,
      last_fetched_at: new Date().toISOString(),
    },
    { onConflict: "source,url" }
  );
  if (error) throw new Error(`取得記録の保存に失敗した: ${error.message}`);
}

// ---------------------------------------------------------------
// 会議録由来の情報
// ---------------------------------------------------------------

/** 議員名から議員IDを引く。会議録の表記ゆれを吸収するため空白を除いて突合する。 */
export async function buildMemberIdByName(): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("council_members")
    .select("id, name");
  if (error) throw new Error(`議員の取得に失敗した: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.name.replace(/[\s\u3000]/g, ""), row.id);
  }
  return map;
}

export type BillDebateUpsert = {
  billId: string;
  speakerName: string;
  seatNumber: number | null;
  councilMemberId: string | null;
  stance: "for" | "against";
  sourceUrl: string;
};

/** 討論を保存する。同じ議案・議員・立場の組は1件にまとめる。 */
export async function upsertBillDebate(
  debate: BillDebateUpsert
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("bill_debates").upsert(
    {
      bill_id: debate.billId,
      speaker_name: debate.speakerName,
      seat_number: debate.seatNumber,
      council_member_id: debate.councilMemberId,
      stance: debate.stance,
      source_url: debate.sourceUrl,
    },
    { onConflict: "bill_id,speaker_name,stance" }
  );
  if (error) throw new Error(`討論の保存に失敗した: ${error.message}`);
}

/** slug から会期IDを引く */
export async function findCouncilSessionIdBySlug(
  slug: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("council_sessions")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

/** slugから会期IDと正確な開会日を引く。 */
export async function findCouncilSessionBySlug(
  slug: string
): Promise<{ id: string; startDate: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("council_sessions")
    .select("id, start_date")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`会期の取得に失敗した: ${error.message}`);
  return data ? { id: data.id, startDate: data.start_date } : null;
}

/** 会期の期間一覧（委員会の開催日と会期を突合するために使う）。 */
export async function listCouncilSessionPeriods(): Promise<
  { id: string; startDate: string; endDate: string }[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("council_sessions")
    .select("id, start_date, end_date");
  if (error) throw new Error(`会期の取得に失敗した: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

/**
 * 議案の当局説明を、いま保存されているものより長い場合だけ上書きする。
 *
 * 本会議の概要説明より委員会の課長説明の方が具体的で長いことが多い。
 * 由来の異なる説明が混ざっても、常に最も充実したものが残るようにする。
 */
export async function updateBillExplanationIfLonger(
  billId: string,
  explanation: string
): Promise<boolean> {
  if (!explanation) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bills")
    .select("explanation_source")
    .eq("id", billId)
    .maybeSingle();

  const current = data?.explanation_source ?? "";
  if (current.length >= explanation.length) return false;

  const { error } = await supabase
    .from("bills")
    .update({ explanation_source: explanation })
    .eq("id", billId);
  if (error) throw new Error(`議案説明の保存に失敗した: ${error.message}`);
  return true;
}

/** 委員会審査の事実（質疑回数・会議記録URL）を保存する。 */
export async function updateBillCommitteeReview(
  billId: string,
  review: { qaCount: number; minutesUrl: string }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bills")
    .update({
      committee_qa_count: review.qaCount,
      committee_minutes_url: review.minutesUrl,
    })
    .eq("id", billId);
  if (error) throw new Error(`委員会審査の保存に失敗した: ${error.message}`);
}
