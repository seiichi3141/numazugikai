import "server-only";
import { createAdminClient } from "@mirai-gikai/supabase";
import type { CouncilSession } from "../../shared/types";

/**
 * アクティブな会期を取得
 */
export async function findActiveCouncilSession(): Promise<CouncilSession | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("council_sessions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch active council session:", error);
    return null;
  }

  return data;
}

/**
 * 指定日時点で開催中の会期を取得
 */
export async function findCurrentCouncilSession(
  targetDate: string
): Promise<CouncilSession | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("council_sessions")
    .select("*")
    .lte("start_date", targetDate)
    .gte("end_date", targetDate)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch current council session:", error);
    return null;
  }

  return data;
}

/**
 * slugで会期を取得
 */
export async function findCouncilSessionBySlug(
  slug: string
): Promise<CouncilSession | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("council_sessions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch council session by slug:", error);
    return null;
  }

  return data;
}

/**
 * 指定日より前の直近の会期を取得
 */
export async function findPreviousCouncilSession(
  beforeStartDate: string
): Promise<CouncilSession | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("council_sessions")
    .select("*")
    .lt("start_date", beforeStartDate)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch previous council session:", error);
    return null;
  }

  return data;
}

/**
 * 指定日より前に閉会した直近の会期を返す。
 *
 * 閉会中のトップページで「どの会期が終わったか」を出すために使う。
 * `findPreviousCouncilSession` はアクティブ会期の開始日を基準に「その前」を返すので、
 * 閉会中（アクティブ会期が無い、または日付が範囲外）の用途には合わない。
 */
export async function findLatestClosedCouncilSession(
  onDate: string
): Promise<CouncilSession | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("council_sessions")
    .select("*")
    .lt("end_date", onDate)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // 同ファイルの他の取得関数と同じく、失敗はカードを出さないだけに留める。
    // トップページ全体を500にするほどの情報ではない。
    console.error("Failed to fetch latest closed diet session:", error);
    return null;
  }
  return data;
}

/** 絞り込みの選択肢に出す会期。slug の無い会期は URL に載せられないので除く。 */
export type CouncilSessionOption = Pick<CouncilSession, "id" | "name"> & {
  slug: string;
};

/**
 * 絞り込みの選択肢に使う会期を新しい順に返す。
 *
 * 件数はファセット RPC が数えるので、ここでは名前と slug だけでよい。
 * 取れなければ失敗させる。選択肢が黙って空になると、絞り込みが消えた
 * のか会期が無いのか画面から区別できない。
 */
export async function findCouncilSessionOptions(): Promise<
  CouncilSessionOption[]
> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("council_sessions")
    .select("id, name, slug")
    .not("slug", "is", null)
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`会期の選択肢の取得に失敗した: ${error.message}`);
  }

  // 問い合わせで null を除いてあるが、型には現れないのでここで絞る
  return (data ?? []).filter(
    (session): session is CouncilSessionOption => session.slug !== null
  );
}
