import type { Database } from "@mirai-gikai/supabase";
import type { SeedBill } from "./select-demo-bills";

type InterviewConfigInsert =
  Database["public"]["Tables"]["interview_configs"]["Insert"];
type InterviewQuestionInsert =
  Database["public"]["Tables"]["interview_questions"]["Insert"];
type InterviewSessionInsert =
  Database["public"]["Tables"]["interview_sessions"]["Insert"];
type InterviewMessageInsert =
  Database["public"]["Tables"]["interview_messages"]["Insert"];
type InterviewReportInsert =
  Database["public"]["Tables"]["interview_report"]["Insert"];

// =============================================================================
// 基本デモ用のインタビューデータ
//
// 賛成／反対／保留、レポート有無、進行中といった状態の組み合わせを一通り
// 揃えるためのデータ。取り込み済みの実在議案に紐づけて作る。
// =============================================================================

export function createInterviewConfig(
  bill: SeedBill
): Omit<InterviewConfigInsert, "id" | "created_at" | "updated_at"> {
  return {
    bill_id: bill.id,
    name: "デフォルト設定",
    status: "public",
    themes: ["賛否", "理由"],
  };
}

export function createInterviewQuestions(
  interviewConfigId: string
): Omit<InterviewQuestionInsert, "id" | "created_at" | "updated_at">[] {
  return [
    {
      interview_config_id: interviewConfigId,
      question: "この議案に賛成ですか？反対ですか？",
      follow_up_guide: "市民としての立場を明確にしてください。",
      quick_replies: ["賛成", "反対", "どちらでもない"],
      question_order: 1,
    },
    {
      interview_config_id: interviewConfigId,
      question: "そう考える理由を教えてください。",
      follow_up_guide:
        "暮らしや仕事のどんな経験からそう感じているのかを具体的に引き出してください。",
      quick_replies: null,
      question_order: 2,
    },
  ];
}

/** インタビューセッションを作成（5パターン × 20回 = 100件） */
export function createInterviewSessions(
  interviewConfigId: string
): Omit<InterviewSessionInsert, "id" | "created_at" | "updated_at">[] {
  const now = new Date();
  const sessions: Omit<
    InterviewSessionInsert,
    "id" | "created_at" | "updated_at"
  >[] = [];

  for (let i = 0; i < 20; i++) {
    const baseOffset = i * 86400000 * 3; // 3日ずつずらす

    // パターン1: 完了 + レポートあり（賛成）
    sessions.push({
      interview_config_id: interviewConfigId,
      user_id: `00000000-0000-0000-0000-${String(i * 5 + 1).padStart(12, "0")}`,
      started_at: new Date(now.getTime() - baseOffset - 3600000).toISOString(),
      completed_at: new Date(
        now.getTime() - baseOffset - 3000000
      ).toISOString(),
    });

    // パターン2: 完了 + レポートあり（反対）
    sessions.push({
      interview_config_id: interviewConfigId,
      user_id: `00000000-0000-0000-0000-${String(i * 5 + 2).padStart(12, "0")}`,
      started_at: new Date(now.getTime() - baseOffset - 7200000).toISOString(),
      completed_at: new Date(
        now.getTime() - baseOffset - 6600000
      ).toISOString(),
    });

    // パターン3: 完了 + レポートあり（中立）
    sessions.push({
      interview_config_id: interviewConfigId,
      user_id: `00000000-0000-0000-0000-${String(i * 5 + 3).padStart(12, "0")}`,
      started_at: new Date(now.getTime() - baseOffset - 10800000).toISOString(),
      completed_at: new Date(
        now.getTime() - baseOffset - 10200000
      ).toISOString(),
    });

    // パターン4: 完了したけどレポート未作成
    sessions.push({
      interview_config_id: interviewConfigId,
      user_id: `00000000-0000-0000-0000-${String(i * 5 + 4).padStart(12, "0")}`,
      started_at: new Date(now.getTime() - baseOffset - 14400000).toISOString(),
      completed_at: new Date(
        now.getTime() - baseOffset - 13800000
      ).toISOString(),
    });

    // パターン5: 進行中（未完了、レポートなし）
    sessions.push({
      interview_config_id: interviewConfigId,
      user_id: `00000000-0000-0000-0000-${String(i * 5 + 5).padStart(12, "0")}`,
      started_at: new Date(now.getTime() - baseOffset - 1800000).toISOString(),
      completed_at: null,
    });
  }

  return sessions;
}

/**
 * 会話の内容は「取り込み済みの議案なら何が選ばれても成り立つ」書き方にしてある。
 * 対象議案は取り込む会期によって変わるため、議案名は冒頭で名指しするだけにとどめる。
 */
function buildConversations(billName: string) {
  const opening = `こんにちは。沼津市議会の議案「${billName}」について、率直なご意見をお聞かせください。この議案に賛成ですか？反対ですか？`;
  const askReason = "そう考える理由を教えてください。";
  const closing = "ありがとうございました。ご意見を承りました。";

  return [
    // パターン1: 賛成（完了 + レポートあり）
    [
      { role: "assistant" as const, content: opening },
      { role: "user" as const, content: "賛成です。" },
      { role: "assistant" as const, content: askReason },
      {
        role: "user" as const,
        content:
          "暮らしに直接関わることなので、必要な費用はかけてほしいです。市の施設は古いものが多いので、先送りにしないでほしいと思っています。",
      },
      { role: "assistant" as const, content: closing },
    ],
    // パターン2: 反対（完了 + レポートあり）
    [
      { role: "assistant" as const, content: opening },
      { role: "user" as const, content: "反対です。" },
      { role: "assistant" as const, content: askReason },
      {
        role: "user" as const,
        content:
          "金額が大きいわりに、なぜ今この順番なのかの説明が足りない気がします。もっと急ぐところが他にあるのではないでしょうか。",
      },
      { role: "assistant" as const, content: closing },
    ],
    // パターン3: どちらでもない（完了 + レポートあり）
    [
      { role: "assistant" as const, content: opening },
      { role: "user" as const, content: "どちらでもないです。" },
      { role: "assistant" as const, content: askReason },
      {
        role: "user" as const,
        content:
          "必要なことだとは思うのですが、金額が妥当なのかを判断する材料が手元にないので、賛成とも反対とも言いにくいです。",
      },
      { role: "assistant" as const, content: closing },
    ],
    // パターン4: 完了したけどレポート未作成
    [
      { role: "assistant" as const, content: opening },
      { role: "user" as const, content: "賛成です。" },
      { role: "assistant" as const, content: askReason },
      {
        role: "user" as const,
        content: "安全に関わることなので、必要な議案だと思います。",
      },
      { role: "assistant" as const, content: closing },
    ],
    // パターン5: 進行中（途中で離脱）
    [
      { role: "assistant" as const, content: opening },
      {
        role: "user" as const,
        content: "うーん、ちょっと考えさせてください。",
      },
    ],
  ];
}

/** インタビューメッセージを作成（5パターンをループ） */
export function createInterviewMessages(
  sessionIds: string[],
  billName: string
): Omit<InterviewMessageInsert, "id" | "created_at">[] {
  const conversations = buildConversations(billName);
  const messages: Omit<InterviewMessageInsert, "id" | "created_at">[] = [];

  sessionIds.forEach((sessionId, sessionIndex) => {
    const conversation = conversations[sessionIndex % conversations.length];
    for (const msg of conversation) {
      messages.push({
        interview_session_id: sessionId,
        role: msg.role,
        content: msg.content,
      });
    }
  });

  return messages;
}

/** インタビューレポートを作成（パターン1,2,3のみ = 5の倍数で0,1,2番目） */
export function createInterviewReports(
  sessionIds: string[]
): Omit<InterviewReportInsert, "id" | "created_at" | "updated_at">[] {
  const reportTemplates = [
    {
      stance: "for" as const,
      summary:
        "市の施設の老朽化を日頃から感じており、暮らしに直結する整備は先送りせず進めてほしい。必要な費用をかけることには賛成の立場をとる。",
      role: "general_citizen" as const,
      role_title: "市民",
      role_description: "市内在住の会社員\n議案の内容に賛同している",
      opinions: [
        {
          title: "老朽化した施設の整備は先送りしないでほしい",
          content:
            "市の施設は古いものが多く、暮らしに直結する整備は必要な費用をかけてでも進めてほしい。",
        },
      ],
    },
    {
      stance: "against" as const,
      summary:
        "金額の大きさに対して優先順位の説明が足りないと感じており、より急ぐ課題があるのではないかという疑問から反対の立場をとる。",
      role: "work_related" as const,
      role_title: "会社員",
      role_description: "市内の事業所に勤務\n市の予算の使い方を気にしている",
      opinions: [
        {
          title: "優先順位の説明が足りない",
          content:
            "金額が大きいわりに、なぜ今この順番で進めるのかの説明が足りない。より急ぐ課題があるのではないか。",
        },
      ],
    },
    {
      stance: "neutral" as const,
      summary:
        "必要性は理解できるものの、金額の妥当性を判断する材料が公開されていないため、現時点では賛否を決めかねている。",
      role: "subject_expert" as const,
      role_title: "元市職員",
      role_description:
        "市の事業に長く関わってきた元職員\n事業費の内訳を確認する習慣がある",
      opinions: [
        {
          title: "金額の妥当性を判断する材料が足りない",
          content:
            "必要性は理解できるが、費用の内訳が分からないため賛否を判断できない。",
        },
      ],
    },
  ];

  const reports: Omit<
    InterviewReportInsert,
    "id" | "created_at" | "updated_at"
  >[] = [];

  // パターン1,2,3（5の倍数で0,1,2番目）のみレポートを作成
  // パターン4: 完了したけどレポート未作成
  // パターン5: 進行中（レポートなし）
  sessionIds.forEach((sessionId, index) => {
    const patternIndex = index % 5;
    if (patternIndex < 3) {
      const loopIndex = Math.floor(index / 5);
      reports.push({
        interview_session_id: sessionId,
        ...reportTemplates[patternIndex],
        is_public_by_user: loopIndex < 5, // 最初の5件は公開
        is_public_by_admin: loopIndex < 3, // 最初の3ループ分は管理者承認済み
      });
    }
  });

  return reports;
}

// =============================================================================
// 固定IDのデモデータ（4種類のロールを1件ずつ確認するため）
// =============================================================================

export const DEMO_SESSION_ID_EXPERT = "00000000-0000-0000-0000-000000000001";
export const DEMO_SESSION_ID_WORK = "00000000-0000-0000-0000-000000000002";
export const DEMO_SESSION_ID_DAILY = "00000000-0000-0000-0000-000000000003";
export const DEMO_SESSION_ID_CITIZEN = "00000000-0000-0000-0000-000000000004";

export const DEMO_REPORT_ID_EXPERT = "00000000-0000-0000-0000-000000000001";
export const DEMO_REPORT_ID_WORK = "00000000-0000-0000-0000-000000000002";
export const DEMO_REPORT_ID_DAILY = "00000000-0000-0000-0000-000000000003";
export const DEMO_REPORT_ID_CITIZEN = "00000000-0000-0000-0000-000000000004";

const roleDemos = [
  {
    sessionId: DEMO_SESSION_ID_EXPERT,
    reportId: DEMO_REPORT_ID_EXPERT,
    userId: "00000000-0000-0000-0000-000000000010",
    startedMinutesAgo: 60,
    completedMinutesAgo: 50,
    stance: "for" as const,
    role: "subject_expert" as const,
    role_title: "元市職員",
    role_description:
      "市の施設管理に長く携わった元職員\n公共施設の営繕業務を担当\n退職後も市政をよく見ている",
    summary:
      "公共施設の傷みは放置するほど後の費用が膨らむため、早めに手を入れる判断は妥当だと考える。工事の仕様と金額の根拠を市民に分かる形で示してほしい。",
    turns: [
      {
        role: "user" as const,
        content:
          "市の施設管理に長く関わっていました。この手の工事は、傷んでから慌てて直すより、早めに手を入れたほうが結局は安く済むんですよ。",
      },
      {
        role: "assistant" as const,
        content:
          "経験からのご意見、ありがとうございます。逆に、気になっている点はありますか？",
      },
      {
        role: "user" as const,
        content:
          "金額の根拠ですね。仕様と単価がどう積み上がっているのかが市民から見えにくい。そこを分かる形で出してもらえると、賛成もしやすいと思います。",
      },
    ],
    opinions: [
      {
        title: "早めの修繕のほうが結局は安く済む",
        content:
          "施設の傷みは放置するほど後の費用が膨らむため、早めに手を入れる判断は妥当だと考える。",
      },
      {
        title: "工事費の根拠を市民に分かる形で示してほしい",
        content:
          "仕様と単価の積み上げが市民から見えにくい。判断材料として公開してほしい。",
      },
    ],
  },
  {
    sessionId: DEMO_SESSION_ID_WORK,
    reportId: DEMO_REPORT_ID_WORK,
    userId: "00000000-0000-0000-0000-000000000011",
    startedMinutesAgo: 120,
    completedMinutesAgo: 110,
    stance: "neutral" as const,
    role: "work_related" as const,
    role_title: "工務店経営者",
    role_description:
      "市内で工務店を営む\n従業員8名\n公共工事の入札に参加することがある",
    summary:
      "工事の必要性には納得しているが、資材と人件費の高騰が続くなかで、市内の中小業者が受けられる発注の仕方になっているかが気がかりだ。",
    turns: [
      {
        role: "user" as const,
        content:
          "市内で工務店をやっています。工事そのものは必要だと思いますよ。ただ、うちみたいな規模の会社が入れる発注になっているかは気になります。",
      },
      {
        role: "assistant" as const,
        content:
          "事業者のお立場からのご意見ですね。具体的にはどのあたりが気になりますか？",
      },
      {
        role: "user" as const,
        content:
          "資材も人件費もずっと上がっているので、契約したときの金額のままだと途中で厳しくなるんです。工期や金額の見直しがきく仕組みだと助かります。",
      },
    ],
    opinions: [
      {
        title: "市内の中小業者が受けられる発注の仕方にしてほしい",
        content:
          "工事の必要性には納得しているが、小規模な市内業者が参加できる発注区分かどうかが気になる。",
      },
      {
        title: "資材・人件費の高騰に対応できる契約にしてほしい",
        content:
          "契約時の金額のままでは途中で採算が合わなくなる。工期や金額を見直せる仕組みを求める。",
      },
    ],
  },
  {
    sessionId: DEMO_SESSION_ID_DAILY,
    reportId: DEMO_REPORT_ID_DAILY,
    userId: "00000000-0000-0000-0000-000000000012",
    startedMinutesAgo: 200,
    completedMinutesAgo: 185,
    stance: "for" as const,
    role: "daily_life_affected" as const,
    role_title: "保護者",
    role_description:
      "小学生の子どもを育てる保護者\nパート勤務\n毎日子どもの送り出しをしている",
    summary:
      "子どもが毎日過ごす場所のことなので、安全に関わる工事は早く進めてほしい。ただし工事中の通学路の安全対策をあわせて考えてほしい。",
    turns: [
      {
        role: "user" as const,
        content:
          "小学生の子どもがいます。子どもが毎日過ごす場所のことなので、安全に関わることは早くやってほしいです。",
      },
      {
        role: "assistant" as const,
        content:
          "お子さんの毎日に関わるお話ですね。心配されていることはありますか？",
      },
      {
        role: "user" as const,
        content:
          "工事中の通学路が心配です。工事車両が出入りする時間帯と子どもが通る時間が重なると危ないので、そこは配慮してほしいなと。",
      },
    ],
    opinions: [
      {
        title: "安全に関わる工事は早く進めてほしい",
        content:
          "子どもが毎日過ごす場所なので、安全に関わる整備は先送りしないでほしい。",
      },
      {
        title: "工事中の通学路の安全対策もあわせて考えてほしい",
        content:
          "工事車両の出入りと子どもの通学時間が重なると危ないため、時間帯の配慮を求める。",
      },
    ],
  },
  {
    sessionId: DEMO_SESSION_ID_CITIZEN,
    reportId: DEMO_REPORT_ID_CITIZEN,
    userId: "00000000-0000-0000-0000-000000000013",
    startedMinutesAgo: 300,
    completedMinutesAgo: 280,
    stance: "neutral" as const,
    role: "general_citizen" as const,
    role_title: "近隣住民",
    role_description:
      "現場の近くに住む会社員\n子どもはいない\n地域の掲示板で市の情報を見ている",
    summary:
      "必要な工事だとは思うが、近隣への説明が事後になりがちで、騒音や通行止めの予定を事前に知りたい。市の情報の届け方に改善の余地がある。",
    turns: [
      {
        role: "user" as const,
        content:
          "近くに住んでいます。必要な工事なんだろうとは思うんですが、いつも工事が始まってから知るんですよね。",
      },
      {
        role: "assistant" as const,
        content:
          "情報が事後になってしまうということですね。どんな形で知りたいですか？",
      },
      {
        role: "user" as const,
        content:
          "騒音がある時間帯とか、道が通れなくなる日程を先に知りたいです。回覧板だと見落とすので、ネットでまとまって見られると助かります。",
      },
    ],
    opinions: [
      {
        title: "工事の予定を事前に知りたい",
        content:
          "騒音の時間帯や通行止めの日程を、工事が始まる前に知らせてほしい。",
      },
      {
        title: "回覧板以外の届け方も用意してほしい",
        content:
          "回覧板は見落とすため、市の工事情報をネットでまとめて確認できるようにしてほしい。",
      },
    ],
  },
];

export const DEMO_REPORT_IDS = roleDemos.map((demo) => ({
  role: demo.role,
  reportId: demo.reportId,
}));

export function createRoleDemoSessions(
  interviewConfigId: string,
  billName: string
): {
  sessions: InterviewSessionInsert[];
  messages: Omit<InterviewMessageInsert, "id" | "created_at">[];
  reports: InterviewReportInsert[];
} {
  const now = new Date();
  const sessions: InterviewSessionInsert[] = [];
  const messages: Omit<InterviewMessageInsert, "id" | "created_at">[] = [];
  const reports: InterviewReportInsert[] = [];

  for (const demo of roleDemos) {
    sessions.push({
      id: demo.sessionId,
      interview_config_id: interviewConfigId,
      user_id: demo.userId,
      started_at: new Date(
        now.getTime() - demo.startedMinutesAgo * 60000
      ).toISOString(),
      completed_at: new Date(
        now.getTime() - demo.completedMinutesAgo * 60000
      ).toISOString(),
    });

    messages.push({
      interview_session_id: demo.sessionId,
      role: "assistant",
      content: `こんにちは。沼津市議会の議案「${billName}」について、率直なご意見をお聞かせください。この議案について、どのようにお考えですか？`,
    });
    for (const turn of demo.turns) {
      messages.push({
        interview_session_id: demo.sessionId,
        role: turn.role,
        content: turn.content,
      });
    }
    messages.push({
      interview_session_id: demo.sessionId,
      role: "assistant",
      content: "ありがとうございました。ご意見を承りました。",
    });

    reports.push({
      id: demo.reportId,
      interview_session_id: demo.sessionId,
      stance: demo.stance,
      summary: demo.summary,
      role: demo.role,
      role_title: demo.role_title,
      role_description: demo.role_description,
      opinions: demo.opinions.map((opinion) => ({ ...opinion })),
      is_public_by_user: true,
      is_public_by_admin: true,
    });
  }

  return { sessions, messages, reports };
}
