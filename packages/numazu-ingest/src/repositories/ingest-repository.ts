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
        external_council_id: session.externalCouncilId ?? null,
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`会期の保存に失敗した: ${error.message}`);
  return data.id;
}

/**
 * 会期が無ければ作り、あればそのIDを返す（既存の日付は上書きしない）。
 *
 * 会期の正確な日付は会期予定ページが持っている。議案審議結果PDFから逆算した
 * 日付でそれを潰さないよう、こちらは insert のみ行う。
 */
export async function ensureCouncilSession(
  session: CouncilSessionUpsert
): Promise<string> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("council_sessions")
    .select("id")
    .eq("slug", session.slug)
    .maybeSingle();
  if (existing) return existing.id;

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

/** 会期IDと議案番号で突合して議案を作成・更新する。 */
export async function upsertBill(bill: BillUpsert): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .upsert(
      {
        council_session_id: bill.councilSessionId,
        bill_number: bill.billNumber,
        bill_number_kind: bill.numberKind,
        bill_number_value: bill.numberValue,
        name: bill.name,
        category: bill.category,
        legal_basis: bill.legalBasis,
        submitted_date: bill.submittedOn,
        submitter: bill.submitter,
        committee_id: bill.committeeId,
        committee_result: bill.committeeResult,
        decided_on: bill.decidedOn,
        status: bill.status,
        status_note: bill.statusNote,
        source_url: bill.sourceUrl,
        document_url: bill.documentUrl,
      },
      { onConflict: "council_session_id,bill_number" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`議案の保存に失敗した: ${error.message}`);
  return data.id;
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

/**
 * 議案の当局説明を保存する。
 *
 * AI解説の材料として使うもので、会議録の全文ではなく当該議案の説明部分のみ。
 */
export async function updateBillExplanation(
  billId: string,
  explanation: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bills")
    .update({ explanation_source: explanation })
    .eq("id", billId);
  if (error) throw new Error(`議案説明の保存に失敗した: ${error.message}`);
}

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

/** 会期に属する議案を議案番号で引けるようにする（会議録との突合に使う）。 */
export async function findBillIdsByNumberForSessions(
  councilSessionIds: readonly string[]
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select("id, bill_number")
    .in("council_session_id", councilSessionIds);
  if (error) throw new Error(`議案の取得に失敗した: ${error.message}`);

  return new Map(
    (data ?? [])
      .filter((row): row is { id: string; bill_number: string } =>
        Boolean(row.bill_number)
      )
      .map((row) => [row.bill_number, row.id])
  );
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

/** DBにあるすべての会期IDを返す（会議録と議案の突合に使う）。 */
export async function listCouncilSessionIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("council_sessions").select("id");
  if (error) throw new Error(`会期の取得に失敗した: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}
