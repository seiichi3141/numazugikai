import { tags, createBillsTags } from "./data";
import { selectDemoBills, type SeedBill } from "./select-demo-bills";
import {
  createInterviewConfig,
  createInterviewQuestions,
  createInterviewSessions,
  createInterviewMessages,
  createInterviewReports,
  createRoleDemoSessions,
  DEMO_REPORT_IDS,
} from "./demo-interview-data";
import {
  createTopicAnalysisConfig,
  createTopicAnalysisQuestions,
  createTopicAnalysisSessions,
  createTopicAnalysisMessages,
  createTopicAnalysisReports,
  createRealisticSession,
  createRealisticMessages,
  createRealisticReport,
  getRealisticSourceMessageLinks,
} from "./topic-analysis-data";
import {
  createAdminClient,
  clearAllData,
  type AdminClient,
} from "../shared/helper";
import {
  isShizuokaLocalSupabaseUrl,
  seedLocalAdminUser,
} from "../shared/admin-user";

/**
 * みらい議会＠沼津市のシード。
 *
 * 議案・会期は取り込み（@mirai-gikai/numazu-ingest）が沼津市議会の公開情報から
 * 入れるため、シードでは作らない。シードが用意するのは
 * - ローカル開発用の admin ユーザー
 * - タグと、取り込み済み議案へのタグ付け
 * - インタビュー／トピック分析の開発用デモデータ
 * の3つで、いずれも取り込み済みの実在議案に紐づける。
 */
async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!isShizuokaLocalSupabaseUrl(supabaseUrl)) {
      throw new Error(
        "Refusing destructive seed: SUPABASE_URL must point to the Shizuoka local Supabase API on port 55421."
      );
    }

    const supabase = createAdminClient();
    await clearAllData(supabase);

    // ローカル開発用の admin ユーザー（ローカル接続時のみ作成される）
    await seedLocalAdminUser(supabase);

    console.log("🏷️  Inserting tags...");
    const { data: insertedTags, error: tagsError } = await supabase
      .from("tags")
      .insert(tags)
      .select("id, label");

    if (tagsError) {
      throw new Error(`Failed to insert tags: ${tagsError.message}`);
    }
    if (!insertedTags) {
      throw new Error("No tags were inserted");
    }
    console.log(`✅ Inserted ${insertedTags.length} tags`);

    // 取り込み済みの議案を取得する。ここが空なら以降のデモデータは作れない。
    const { data: existingBills, error: billsError } = await supabase
      .from("bills")
      .select("id, name")
      .order("submitted_date", { ascending: false })
      .limit(1000);

    if (billsError) {
      throw new Error(`Failed to fetch bills: ${billsError.message}`);
    }

    const bills: SeedBill[] = existingBills ?? [];
    if (bills.length === 0) {
      console.log(
        "\n⚠️  議案が1件もないため、タグ付けとインタビューのデモデータをスキップしました。"
      );
      console.log(
        "   議案は取り込みで投入します。README の「議案データの取り込み」を参照してください。"
      );
      console.log("\n🎉 Database seeding completed successfully!");
      console.log("\n📊 Summary:");
      console.log(`  Tags: ${insertedTags.length}`);
      console.log("  Bills: 0 (取り込み待ち)");
      return;
    }

    console.log(`📄 Found ${bills.length} ingested bills`);

    console.log("🔗 Inserting bills-tags relations...");
    const billsTags = createBillsTags(bills, insertedTags);
    if (billsTags.length > 0) {
      const { error: billsTagsError } = await supabase
        .from("bills_tags")
        .insert(billsTags);
      if (billsTagsError) {
        throw new Error(
          `Failed to insert bills-tags relations: ${billsTagsError.message}`
        );
      }
    }
    console.log(`✅ Inserted ${billsTags.length} bills-tags relations`);

    const { demoBill, topicAnalysisBill } = selectDemoBills(bills);

    const demoCounts = await seedDemoInterview(supabase, demoBill);
    const topicCounts = await seedTopicAnalysisInterview(
      supabase,
      topicAnalysisBill
    );

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`  Tags: ${insertedTags.length}`);
    console.log(`  Bills (取り込み済み): ${bills.length}`);
    console.log(`  Bills-Tags Relations: ${billsTags.length}`);
    console.log(`  Demo Interview Sessions: ${demoCounts.sessions}`);
    console.log(`  Topic Analysis Sessions: ${topicCounts.sessions}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

/**
 * 対象議案の knowledge_source を設定する。
 * インタビューのチャットが議案の説明を参照するために使う。
 */
async function setKnowledgeSource(
  supabase: AdminClient,
  bill: SeedBill
): Promise<void> {
  const { error } = await supabase
    .from("bills")
    .update({
      knowledge_source: `沼津市議会の議案「${bill.name}」について、市民としてのご意見をお聞かせください。`,
      use_knowledge_source_in_chat: true,
    })
    .eq("id", bill.id);

  if (error) {
    throw new Error(
      `Failed to update knowledge_source for bill ${bill.name} (${bill.id}): ${error.message}`
    );
  }
}

/** 賛否・レポート有無・進行中を一通り揃えた基本デモ */
async function seedDemoInterview(
  supabase: AdminClient,
  bill: SeedBill | null
): Promise<{ sessions: number }> {
  if (!bill) {
    console.log("\n⏭️  基本デモのインタビュー: 対象にできる議案がないためスキップ");
    return { sessions: 0 };
  }

  console.log(`\n💬 基本デモのインタビュー（対象議案: ${bill.name}）`);
  await setKnowledgeSource(supabase, bill);

  const { data: config, error: configError } = await supabase
    .from("interview_configs")
    .insert(createInterviewConfig(bill))
    .select("id")
    .single();

  if (configError || !config) {
    throw new Error(
      `Failed to insert interview config: ${configError?.message}`
    );
  }

  const { error: questionsError } = await supabase
    .from("interview_questions")
    .insert(createInterviewQuestions(config.id));
  if (questionsError) {
    throw new Error(
      `Failed to insert interview questions: ${questionsError.message}`
    );
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("interview_sessions")
    .insert(createInterviewSessions(config.id))
    .select("id");
  if (sessionsError || !sessions) {
    throw new Error(
      `Failed to insert interview sessions: ${sessionsError?.message}`
    );
  }

  const sessionIds = sessions.map((s) => s.id);

  const { error: messagesError } = await supabase
    .from("interview_messages")
    .insert(createInterviewMessages(sessionIds, bill.name));
  if (messagesError) {
    throw new Error(
      `Failed to insert interview messages: ${messagesError.message}`
    );
  }

  const { error: reportsError } = await supabase
    .from("interview_report")
    .insert(createInterviewReports(sessionIds));
  if (reportsError) {
    throw new Error(
      `Failed to insert interview reports: ${reportsError.message}`
    );
  }

  // 4種類のロールを1件ずつ確認するための固定IDデータ
  const roleDemo = createRoleDemoSessions(config.id, bill.name);
  const { error: roleSessionsError } = await supabase
    .from("interview_sessions")
    .insert(roleDemo.sessions);
  if (roleSessionsError) {
    throw new Error(
      `Failed to insert role demo sessions: ${roleSessionsError.message}`
    );
  }

  const { error: roleMessagesError } = await supabase
    .from("interview_messages")
    .insert(roleDemo.messages);
  if (roleMessagesError) {
    throw new Error(
      `Failed to insert role demo messages: ${roleMessagesError.message}`
    );
  }

  const { error: roleReportsError } = await supabase
    .from("interview_report")
    .insert(roleDemo.reports);
  if (roleReportsError) {
    throw new Error(
      `Failed to insert role demo reports: ${roleReportsError.message}`
    );
  }

  console.log(
    `✅ ${sessionIds.length} sessions + ${roleDemo.sessions.length} role demo sessions`
  );
  for (const { role, reportId } of DEMO_REPORT_IDS) {
    console.log(`   ${role}: /report/${reportId}#chat-log`);
  }

  return { sessions: sessionIds.length + roleDemo.sessions.length };
}

/** 立場の異なる10人分の意見を集めたトピック分析用デモ */
async function seedTopicAnalysisInterview(
  supabase: AdminClient,
  bill: SeedBill | null
): Promise<{ sessions: number }> {
  if (!bill) {
    console.log(
      "\n⏭️  トピック分析のデモ: 会話が予算案を前提にしているため、予算案が取り込まれるまでスキップ"
    );
    return { sessions: 0 };
  }

  console.log(`\n📈 トピック分析のデモ（対象議案: ${bill.name}）`);
  await setKnowledgeSource(supabase, bill);

  const { data: config, error: configError } = await supabase
    .from("interview_configs")
    .insert(createTopicAnalysisConfig(bill))
    .select("id")
    .single();
  if (configError || !config) {
    throw new Error(
      `Failed to insert topic analysis config: ${configError?.message}`
    );
  }

  const { error: questionsError } = await supabase
    .from("interview_questions")
    .insert(createTopicAnalysisQuestions(config.id));
  if (questionsError) {
    throw new Error(
      `Failed to insert topic analysis questions: ${questionsError.message}`
    );
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("interview_sessions")
    .insert(createTopicAnalysisSessions(config.id))
    .select("id");
  if (sessionsError || !sessions) {
    throw new Error(
      `Failed to insert topic analysis sessions: ${sessionsError?.message}`
    );
  }

  const sessionIds = sessions.map((s) => s.id);

  const { error: messagesError } = await supabase
    .from("interview_messages")
    .insert(createTopicAnalysisMessages(sessionIds, bill.name));
  if (messagesError) {
    throw new Error(
      `Failed to insert topic analysis messages: ${messagesError.message}`
    );
  }

  // 挿入したユーザー発言を取り直して source_message_id を紐付ける。
  // bulk insert では全行の created_at が同じになり、id も UUID なので
  // 「何番目の発言か」では対象を特定できない。発言内容は 1 セッション内で
  // 一意なので、(セッションID, 本文) をキーにして引き当てる。
  const { data: userMessages, error: userMessagesError } = await supabase
    .from("interview_messages")
    .select("id, interview_session_id, content")
    .in("interview_session_id", sessionIds)
    .eq("role", "user");
  if (userMessagesError) {
    throw new Error(
      `Failed to fetch user messages: ${userMessagesError.message}`
    );
  }

  const messageIdByKey = new Map<string, string>();
  for (const msg of userMessages ?? []) {
    messageIdByKey.set(`${msg.interview_session_id}\n${msg.content}`, msg.id);
  }

  const reports = createTopicAnalysisReports(sessionIds);
  for (const report of reports) {
    if (!Array.isArray(report.opinions)) continue;
    const opinions = report.opinions as Array<{
      source_message_id?: string;
      source_message_content?: string;
    }>;
    for (const opinion of opinions) {
      const messageId = messageIdByKey.get(
        `${report.interview_session_id}\n${opinion.source_message_content}`
      );
      // 引き当てられないのは seed データの不整合。黙って通すと
      // source_message_id が欠けたレポートが入るので落とす。
      if (!messageId) {
        throw new Error(
          `Topic analysis seed: failed to resolve source message for session ${report.interview_session_id}`
        );
      }
      opinion.source_message_id = messageId;
    }
  }

  const { error: reportsError } = await supabase
    .from("interview_report")
    .insert(reports);
  if (reportsError) {
    throw new Error(
      `Failed to insert topic analysis reports: ${reportsError.message}`
    );
  }

  const realisticSessionCount = await seedRealisticSession(supabase, config.id);

  console.log(
    `✅ ${sessionIds.length} sessions (各3意見) + ${realisticSessionCount} realistic session`
  );

  return { sessions: sessionIds.length + realisticSessionCount };
}

/** 深掘りの往復を含む自然な会話ログを1件だけ作る */
async function seedRealisticSession(
  supabase: AdminClient,
  configId: string
): Promise<number> {
  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .insert(createRealisticSession(configId))
    .select("id")
    .single();
  if (sessionError || !session) {
    throw new Error(
      `Failed to insert realistic session: ${sessionError?.message}`
    );
  }

  const messages = createRealisticMessages(session.id);
  // 1回の bulk insert だと全行が同一 created_at になり、返却順も UUID 依存で不定。
  // id + content を返してもらい、content で対象を特定する。
  const { data: insertedMessages, error: messagesError } = await supabase
    .from("interview_messages")
    .insert(messages)
    .select("id, content");
  if (messagesError || !insertedMessages) {
    throw new Error(
      `Failed to insert realistic messages: ${messagesError?.message}`
    );
  }

  // opinions の source_message_id を後付けする。
  // content は会話ログ内で一意な前提（手で書いた seed データなので成り立つ）。
  // 未解決は seed データの不整合なので fail fast させる。
  const report = createRealisticReport(session.id);
  if (!Array.isArray(report.opinions)) {
    throw new Error(
      "Realistic report opinions must be an array to wire source_message_id"
    );
  }
  const opinions = report.opinions as Array<{
    source_message_id?: string;
    source_message_content?: string;
    contextual_quote?: string;
  }>;
  const contentToId = new Map(
    insertedMessages.map((m) => [m.content, m.id] as const)
  );
  const links = getRealisticSourceMessageLinks();
  for (const { conversationIndex, opinionIndex } of links) {
    const content = messages[conversationIndex]?.content;
    if (!content) {
      throw new Error(
        `Realistic seed: conversationIndex ${conversationIndex} out of range`
      );
    }
    const messageId = contentToId.get(content);
    if (!messageId) {
      throw new Error(
        `Realistic seed: failed to resolve inserted message for conversationIndex=${conversationIndex}`
      );
    }
    const opinion = opinions[opinionIndex];
    if (!opinion) {
      throw new Error(
        `Realistic seed: opinionIndex ${opinionIndex} out of range`
      );
    }
    opinion.source_message_id = messageId;
    opinion.source_message_content = content;
    opinion.contextual_quote = content;
  }

  const { error: reportError } = await supabase
    .from("interview_report")
    .insert(report);
  if (reportError) {
    throw new Error(
      `Failed to insert realistic report: ${reportError.message}`
    );
  }

  return 1;
}

seedDatabase();
