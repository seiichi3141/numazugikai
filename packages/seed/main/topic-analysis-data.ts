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
// トピック分析デモ用のインタビューデータ
//
// 市の予算案を題材に、立場の異なる10人分の意見を用意する。
// トピック分析は「多様な意見をどうまとめるか」を見る機能なので、
// 賛否だけでなく関心の分野そのものがばらけるようにしてある。
//
// 発言はすべて架空の市民の声で、実在の市議会議員の発言ではない。
// 予算に何が計上されているかを断定せず、暮らしの実感と要望として書いている。
// =============================================================================

type Stance = "for" | "against" | "neutral" | "conditional_for";
type ReportRole =
  | "subject_expert"
  | "work_related"
  | "daily_life_affected"
  | "general_citizen";

/** @mirai-gikai/shared の REASONING_TYPES と同じ値を使う */
type ReasoningType =
  | "personal_experience"
  | "family_observation"
  | "professional_expertise"
  | "research_reference"
  | "overseas_example"
  | "intuition"
  | "none";

type SeedOpinion = {
  title: string;
  content: string;
  /** この意見の根拠になるユーザー発言（そのまま interview_messages に入る） */
  source_message_content: string;
  concern: string | null;
  proposal: string | null;
  reasoning_types: ReasoningType[];
  bill_sentiment: "期待" | "懸念" | null;
  richness: number;
};

type SeedPattern = {
  stance: Stance;
  summary: string;
  role: ReportRole;
  role_title: string;
  role_description: string;
  opinions: SeedOpinion[];
};

export function createTopicAnalysisConfig(
  bill: SeedBill
): Omit<InterviewConfigInsert, "id" | "created_at" | "updated_at"> {
  return {
    bill_id: bill.id,
    name: "デフォルト設定",
    status: "public",
    themes: ["予算の重点", "暮らしへの影響", "使い道への要望"],
  };
}

export function createTopicAnalysisQuestions(
  configId: string
): Omit<InterviewQuestionInsert, "id" | "created_at" | "updated_at">[] {
  return [
    {
      interview_config_id: configId,
      question: "市の予算案について、賛成ですか？反対ですか？",
      follow_up_guide:
        "賛否とあわせて、そう感じている背景にある暮らしや仕事の状況を引き出してください。",
      quick_replies: ["賛成", "反対", "条件付きで賛成"],
      question_order: 1,
    },
    {
      interview_config_id: configId,
      question:
        "市の予算の使い道は、あなたの暮らしや仕事にどのような影響がありますか？",
      follow_up_guide:
        "実際に困っている場面や助かっている場面を具体的に聞いてください。",
      quick_replies: null,
      question_order: 2,
    },
    {
      interview_config_id: configId,
      question: "特に力を入れてほしい分野や、気になっている点はありますか？",
      follow_up_guide:
        "要望を「誰が何をするか」が分かる粒度まで具体化してください。",
      quick_replies: null,
      question_order: 3,
    },
  ];
}

const opinionPatterns: SeedPattern[] = [
  // パターン1: 子育て中の保護者
  {
    stance: "conditional_for",
    summary:
      "子育て世帯の毎日を支える部分にもっと予算を向けてほしい。学童保育の枠と学校施設の傷みが特に気がかりで、そこが手当てされるなら賛成できる。",
    role: "daily_life_affected",
    role_title: "保護者",
    role_description:
      "小学生2人を育てる保護者\nパート勤務\n放課後は学童保育を利用している",
    opinions: [
      {
        title: "学童保育の受け入れ枠が足りていない",
        content:
          "申し込んでも入れるか分からず、働く時間を決められない。定員と職員体制を増やしてほしい。",
        source_message_content:
          "学童、毎年申し込むんですけど入れるかどうか直前まで分からないんですよ。だからシフトも決められなくて。定員と、あと働く人を増やしてもらえないかなとずっと思っています。",
        concern: "学童保育に入れるか直前まで分からず就労予定が立てられない",
        proposal: "学童保育の定員と職員体制を増やしてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 72,
      },
      {
        title: "学校の施設の傷みが気になる",
        content:
          "子どもが毎日過ごす場所なので、雨漏りや外壁の傷みは早めに直してほしい。",
        source_message_content:
          "参観日に行くと、廊下の天井にシミがあったり、外壁がだいぶ傷んでいたりして。子どもが毎日いる場所なので、そこは早めに直してほしいです。",
        concern: "校舎の雨漏りや外壁の傷みが放置されている",
        proposal: "学校施設の修繕を早めに進めてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 65,
      },
      {
        title: "子育て世帯向けの情報が届きにくい",
        content:
          "支援制度を後から知ることが多い。対象になる人に届く形で知らせてほしい。",
        source_message_content:
          "使える制度があったのを後から知ることが多いんです。広報に載ってたよって言われても、全部は読めないので……対象の人に直接届く形にしてもらえると助かります。",
        concern: "利用できる支援制度を知らないまま期限を過ぎてしまう",
        proposal: "対象世帯に直接届く形で子育て支援の情報を知らせてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 58,
      },
    ],
  },
  // パターン2: 市内で商店を営む店主
  {
    stance: "for",
    summary:
      "物価と光熱費の高騰で個人商店は体力を削られている。事業者を支える予算は必要で、商店街に人が戻る取り組みとあわせて進めてほしい。",
    role: "work_related",
    role_title: "商店主",
    role_description:
      "市内の商店街で店を営む\n創業から30年\n従業員は家族を含めて3名",
    opinions: [
      {
        title: "光熱費と仕入れ値の高騰が経営を圧迫している",
        content:
          "売上は横ばいなのに経費だけが増えている。小規模事業者への支援を続けてほしい。",
        source_message_content:
          "売上はそんなに変わってないのに、電気代と仕入れがどんどん上がるんですよ。うちみたいな小さい店だと値段に転嫁しきれないので、正直きついです。事業者向けの支援は続けてほしいですね。",
        concern: "光熱費と仕入れ値の上昇分を価格に転嫁できず利益が減っている",
        proposal: "小規模事業者向けの支援を継続してほしい",
        reasoning_types: ["personal_experience", "professional_expertise"],
        bill_sentiment: "期待",
        richness: 78,
      },
      {
        title: "商店街の空き店舗が増えている",
        content:
          "シャッターが増えると人通りも減る。新しく店を出す人を後押しする仕組みがほしい。",
        source_message_content:
          "うちの並びだけで、この5年で3軒閉まりました。シャッターが増えると人も歩かなくなるんですよね。新しく店を始める人に、家賃でも改装費でもいいので後押しがあればと思います。",
        concern: "空き店舗の増加で商店街の人通りがさらに減っている",
        proposal: "新規出店者への家賃や改装費の後押しをしてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 74,
      },
      {
        title: "イベントのときだけ人が来て終わってしまう",
        content:
          "催しの日は賑わうが平日につながらない。日常的に人が来る仕掛けを考えてほしい。",
        source_message_content:
          "お祭りとかイベントの日はすごく人が来るんです。でも翌週の平日はいつも通り。そこがつながらないと意味がないなと、毎回思っています。",
        concern: "イベント時の賑わいが平常時の来街につながっていない",
        proposal: "平日の来街につながる仕掛けを考えてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 61,
      },
    ],
  },
  // パターン3: 家族の介護をしている市民
  {
    stance: "neutral",
    summary:
      "介護は費用も手続きも負担が大きい。予算を増やすこと自体には賛成だが、窓口の分かりにくさが解消されないと実感につながらない。",
    role: "daily_life_affected",
    role_title: "介護をしている会社員",
    role_description:
      "同居する親の介護をしている会社員\n介護と仕事を両立して4年目\n在宅サービスを利用中",
    opinions: [
      {
        title: "介護にかかる自己負担が重い",
        content:
          "サービスを増やすと負担も増えるため、必要な分を使えていない。負担軽減を検討してほしい。",
        source_message_content:
          "デイサービスを増やしたいんですけど、増やすとその分お金もかかるので、結局我慢しています。必要な分を使えないのは本末転倒だなと。",
        concern: "自己負担を気にして必要な介護サービスを利用できていない",
        proposal: "介護サービスの自己負担軽減を検討してほしい",
        reasoning_types: ["personal_experience", "family_observation"],
        bill_sentiment: "懸念",
        richness: 70,
      },
      {
        title: "相談する窓口がどこか分かりにくい",
        content:
          "制度ごとに担当が分かれていて、たらい回しになる。最初の相談先を一本化してほしい。",
        source_message_content:
          "最初のころ、どこに聞けばいいのか全然分からなくて。電話するたびに別のところを案内されて、半日つぶれたこともあります。最初の相談先が一つにまとまっていると助かります。",
        concern: "担当が分かれていて相談先にたどり着くまでに時間がかかる",
        proposal: "介護の最初の相談先を一本化してほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 76,
      },
      {
        title: "在宅を支えるサービスに空きがない",
        content:
          "希望する事業所が埋まっていて選べない。担い手を増やす取り組みが必要だと感じる。",
        source_message_content:
          "希望する事業所はどこも埋まっていて、選ぶというより空いているところにお願いするしかない状態です。働く人が足りていないんだろうなと思います。",
        concern: "在宅介護サービスの空きがなく事業所を選べない",
        proposal: "介護の担い手を増やす取り組みを進めてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 68,
      },
    ],
  },
  // パターン4: 市立病院を利用している市民
  {
    stance: "for",
    summary:
      "持病で市立病院に通っており、地域に病院が残ることの価値を実感している。経営を支える予算には賛成で、夜間の受け入れ体制もあわせて守ってほしい。",
    role: "general_citizen",
    role_title: "通院している市民",
    role_description:
      "持病で市立病院に定期通院している\n70代\n家族と2人暮らし",
    opinions: [
      {
        title: "地域に病院が残ることの価値は大きい",
        content:
          "通える距離に病院があるから治療を続けられている。経営を支える支出は必要だと考える。",
        source_message_content:
          "月に一度通っているんですが、ここがなくなったら通える距離に代わりがないんです。だから病院を支えるお金は、必要なものだと思っています。",
        concern: null,
        proposal: "市立病院の経営を支える支出を続けてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "期待",
        richness: 66,
      },
      {
        title: "夜間や休日に診てもらえるか不安がある",
        content:
          "夜に具合が悪くなったときの受け入れ先が心配。夜間の体制を維持してほしい。",
        source_message_content:
          "夜中に具合が悪くなったとき、どこに行けばいいのかいつも不安なんです。夜に診てもらえるところは、なんとか残してほしいです。",
        concern: "夜間や休日に受診できる場所が確保できるか不安",
        proposal: "夜間の救急受け入れ体制を維持してほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 63,
      },
      {
        title: "通院の足がないと医療にたどり着けない",
        content:
          "運転をやめた後の移動手段がない。通院に使える交通手段を考えてほしい。",
        source_message_content:
          "去年、免許を返納したんです。それからは家族に送ってもらうか、タクシーか。バスは本数が少なくて。病院があっても行けなければ同じですから、そこも考えてほしいですね。",
        concern: "免許返納後に通院の移動手段が確保できない",
        proposal: "通院に使える公共交通の手段を考えてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 79,
      },
    ],
  },
  // パターン5: 地区の自治会長
  {
    stance: "conditional_for",
    summary:
      "大きな事業も必要だが、生活道路や側溝といった身近な維持管理が後回しになっている。地域の下支えに配分があるなら賛成する。",
    role: "general_citizen",
    role_title: "自治会長",
    role_description:
      "地区の自治会長を務めている\n就任3年目\n地域の要望を市に取り次いでいる",
    opinions: [
      {
        title: "生活道路や側溝の傷みが直らない",
        content:
          "要望を出しても順番待ちが長い。身近な維持管理にも配分を確保してほしい。",
        source_message_content:
          "側溝のふたが割れているとか、道路がへこんでいるとか、そういう要望を毎年出すんですが、順番待ちが長くて。大きい事業も大事ですけど、身近なところにもお金を回してほしいです。",
        concern: "生活道路や側溝の補修が順番待ちで長期間放置される",
        proposal: "身近な道路・側溝の維持管理にも予算を確保してほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 75,
      },
      {
        title: "避難所の備蓄と設備が古い",
        content:
          "訓練のたびに不足が見つかる。避難所の備蓄と設備の更新を計画的に進めてほしい。",
        source_message_content:
          "毎年防災訓練をやるんですが、そのたびに備蓄が足りないとか、発電機が動かないとか出てくるんですよ。いざというときに使えないと意味がないので、計画的に更新してほしいです。",
        concern: "避難所の備蓄不足や設備の不具合が訓練のたびに見つかる",
        proposal: "避難所の備蓄と設備を計画的に更新してほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 77,
      },
      {
        title: "地域の担い手が高齢化している",
        content:
          "行事も防災も同じ人が支えている。地域活動を担う人を増やす後押しがほしい。",
        source_message_content:
          "行事も防災も、結局いつも同じ顔ぶれなんです。しかもみんな年をとってきている。若い人が関わりやすくなる後押しがないと、地域の活動そのものが続かないと思います。",
        concern: "地域活動の担い手が高齢化し活動の継続が難しい",
        proposal: "若い世代が地域活動に関わりやすくなる後押しをしてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 71,
      },
    ],
  },
  // パターン6: 農業を営む市民
  {
    stance: "against",
    summary:
      "農地を維持するための整備や鳥獣対策に手が回っておらず、この配分では現場は続けられない。第一次産業への配分を見直してほしい。",
    role: "work_related",
    role_title: "農業者",
    role_description:
      "市内で野菜を生産している\n就農25年\n家族経営で農地を維持している",
    opinions: [
      {
        title: "農道と水路の整備が後回しになっている",
        content:
          "傷んだ農道は自分たちで直している。基盤の整備に配分を戻してほしい。",
        source_message_content:
          "農道が崩れても、待っていても直らないので結局自分たちで砂利を入れています。作物を作る以前の話なんですよ。基盤の整備にもう少しお金を回してほしいです。",
        concern: "農道や水路の補修が進まず生産者が自費で対応している",
        proposal: "農道・水路など生産基盤の整備に予算を配分してほしい",
        reasoning_types: ["personal_experience", "professional_expertise"],
        bill_sentiment: "懸念",
        richness: 76,
      },
      {
        title: "鳥獣による被害が続いている",
        content:
          "柵を張っても被害が出る。地域全体で取り組める対策を進めてほしい。",
        source_message_content:
          "柵は張っているんですが、それでも入られます。一軒だけ対策しても隣が空いていれば同じなので、地域でまとめてやれる形にしないと減らないですね。",
        concern: "個別の対策では鳥獣被害を防ぎきれない",
        proposal: "地域単位でまとめて取り組める鳥獣対策を進めてほしい",
        reasoning_types: ["personal_experience", "professional_expertise"],
        bill_sentiment: "懸念",
        richness: 73,
      },
      {
        title: "新しく農業を始める人が続かない",
        content:
          "初期投資が重く数年で辞めてしまう。就農後を支える仕組みが必要だと感じる。",
        source_message_content:
          "始める人はいるんです。でも機械も土地もお金がかかるので、数年で辞めてしまう。始めるときだけじゃなくて、続けるところを支えないと人は残らないと思います。",
        concern: "新規就農者が初期投資の負担で数年以内に離農している",
        proposal: "就農後の継続を支える仕組みをつくってほしい",
        reasoning_types: ["personal_experience", "professional_expertise"],
        bill_sentiment: "懸念",
        richness: 74,
      },
    ],
  },
  // パターン7: 車で通勤する会社員
  {
    stance: "neutral",
    summary:
      "道路の整備には期待しているが、工事が長引くあいだの生活道路への影響が大きい。進め方次第で評価が変わると考えている。",
    role: "daily_life_affected",
    role_title: "会社員",
    role_description:
      "市外へ車で通勤している会社員\n通勤時間は片道40分\n渋滞を避けて抜け道を使うことがある",
    opinions: [
      {
        title: "朝夕の渋滞が慢性化している",
        content:
          "同じ区間で毎日詰まる。交差点や信号の運用も含めて改善してほしい。",
        source_message_content:
          "朝は毎日、決まった交差点で詰まるんですよ。道を広げるだけじゃなくて、信号の時間を変えるとかでも変わると思うんですけどね。",
        concern: "特定の交差点で朝夕の渋滞が慢性化している",
        proposal: "交差点や信号の運用も含めて渋滞対策をしてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 64,
      },
      {
        title: "工事が長引くと生活道路に車が流れ込む",
        content:
          "迂回した車が住宅街を抜けていく。工事中の交通の逃がし方も設計してほしい。",
        source_message_content:
          "工事で片側通行になると、みんな住宅街を抜けていくんです。子どもが歩いている道なので、あれは危ない。工事中に車をどこに流すかまで考えてほしいです。",
        concern: "工事の迂回車両が住宅街の生活道路に流入して危険",
        proposal: "工事中の迂回経路まで含めて交通対策を設計してほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 78,
      },
      {
        title: "公共交通に切り替えたくても本数が足りない",
        content:
          "車をやめたいが通勤時間に合う便がない。通勤時間帯の運行を増やしてほしい。",
        source_message_content:
          "本当は電車とバスで通いたいんです。でも家からバス停まで遠いし、朝の便が合わない。通勤の時間帯だけでも本数があれば、車をやめる人はいると思いますよ。",
        concern: "通勤時間帯に使える公共交通の便がなく車に頼らざるを得ない",
        proposal: "通勤時間帯の公共交通の本数を増やしてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 69,
      },
    ],
  },
  // パターン8: 観光・飲食業の事業者
  {
    stance: "for",
    summary:
      "観光で人が来ることは地域の収入に直結する。港や自然を生かす予算には賛成で、周遊しやすくする交通の手当てを求めたい。",
    role: "work_related",
    role_title: "飲食店経営者",
    role_description:
      "沼津港の近くで飲食店を営む\n観光客と地元客が半々\n繁忙期は人手が足りない",
    opinions: [
      {
        title: "観光客が港の周辺だけで帰ってしまう",
        content:
          "市内の他の場所まで足を伸ばしてもらえていない。周遊を促す取り組みを求める。",
        source_message_content:
          "港には人が来るんですけど、そこで食べて帰っちゃうんですよね。もう少し市内の他のところまで回ってもらえたら、うちだけじゃなく全体が潤うのにと思います。",
        concern: "観光客の滞在が港周辺で完結し市内に広がらない",
        proposal: "市内を周遊してもらう取り組みを進めてほしい",
        reasoning_types: ["personal_experience", "professional_expertise"],
        bill_sentiment: "懸念",
        richness: 72,
      },
      {
        title: "西浦や戸田まで行く交通手段が乏しい",
        content:
          "車がない観光客は海沿いまで行けない。二次交通を整えてほしい。",
        source_message_content:
          "お客さんに西浦や戸田を勧めても、車がないと行けないんですよ。バスの時間を調べると、行って帰ってで一日仕事になる。そこの足があれば、もっと回ってもらえます。",
        concern: "車のない観光客が西浦・戸田方面へ移動できない",
        proposal: "観光地をつなぐ二次交通を整えてほしい",
        reasoning_types: ["personal_experience", "professional_expertise"],
        bill_sentiment: "懸念",
        richness: 77,
      },
      {
        title: "繁忙期の人手が確保できない",
        content:
          "季節による波が大きく通年雇用が難しい。人手を確保する支援がほしい。",
        source_message_content:
          "連休は行列ができるのに、平日は静か。波が大きすぎて通年で人を雇えないんです。だから忙しい時期に限って人が足りない。ここは個々の店だけでは解決できないところです。",
        concern: "繁忙期と閑散期の差が大きく通年雇用ができない",
        proposal: "観光事業者の人手確保を支援してほしい",
        reasoning_types: ["personal_experience", "professional_expertise"],
        bill_sentiment: "懸念",
        richness: 75,
      },
    ],
  },
  // パターン9: 財政資料を読み込んでいる市民
  {
    stance: "against",
    summary:
      "単年度で見れば通る予算でも、長期の負担が積み上がっている。将来の返済見通しが示されるまでは賛成できない。",
    role: "subject_expert",
    role_title: "経理担当",
    role_description:
      "民間企業で経理を担当している\n決算書の読み方を業務で扱う\n市の財政資料を毎年確認している",
    opinions: [
      {
        title: "将来の借入返済の見通しが読み取れない",
        content:
          "単年度の収支だけでは判断できない。長期の返済計画をあわせて示してほしい。",
        source_message_content:
          "仕事柄、決算書は毎日見ています。市の資料も見るんですが、単年度の収支は出ていても、この先何年でいくら返すのかが読み取れないんですよ。そこがないと賛否の判断はできません。",
        concern: "長期の借入返済見通しが資料から読み取れない",
        proposal: "長期の返済計画をあわせて公表してほしい",
        reasoning_types: ["professional_expertise"],
        bill_sentiment: "懸念",
        richness: 82,
      },
      {
        title: "長期契約のコストが単年度の資料に表れない",
        content:
          "複数年にまたがる契約の総額が見えにくい。契約期間全体の負担を開示してほしい。",
        source_message_content:
          "何年もかけて払っていく契約って、その年の予算書だけ見ても総額が分からないんです。企業なら注記で開示するところですよね。契約期間全体でいくらなのかを出してほしい。",
        concern: "複数年契約の総額が単年度の予算資料からは把握できない",
        proposal: "長期契約は契約期間全体の負担額を開示してほしい",
        reasoning_types: ["professional_expertise"],
        bill_sentiment: "懸念",
        richness: 84,
      },
      {
        title: "予算資料が市民にとって読みにくい",
        content:
          "専門用語が多く一般には理解が難しい。要点をまとめた説明資料がほしい。",
        source_message_content:
          "私は仕事で慣れているので読めますが、普通の人には無理だと思います。用語も多いし、量も多い。要点だけまとめた説明があれば、関心を持つ人は増えるはずです。",
        concern: "予算資料が専門的で市民が内容を把握できない",
        proposal: "要点をまとめた市民向けの説明資料を作ってほしい",
        reasoning_types: ["professional_expertise"],
        bill_sentiment: "懸念",
        richness: 70,
      },
    ],
  },
  // パターン10: 市内在住の学生
  {
    stance: "conditional_for",
    summary:
      "若い世代が住み続けられる条件が整うなら賛成したい。働く場と夜の移動手段、手続きのデジタル化が変われば残る人は増えると思う。",
    role: "general_citizen",
    role_title: "大学生",
    role_description:
      "市内在住の大学生\n市外の大学に通っている\n就職活動を控えている",
    opinions: [
      {
        title: "働く場が少なく同級生が市外に出ていく",
        content:
          "就職先の選択肢が少ないため戻ってこない。若い世代の働く場を増やす取り組みを求める。",
        source_message_content:
          "周りの友達、就職で市外に出る人がほとんどです。地元で働きたい気持ちがあっても、選べるほど求人がないんですよ。ここが変わらないと、若い人は戻ってこないと思います。",
        concern: "市内の求人が少なく若い世代が市外へ流出している",
        proposal: "若い世代が選べる働く場を増やす取り組みを進めてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 73,
      },
      {
        title: "夜に帰る手段がない",
        content:
          "終電後やバスがない時間は移動できない。夜間の交通手段を確保してほしい。",
        source_message_content:
          "アルバイトが終わる時間だと、もうバスがないんです。親に迎えに来てもらうか、歩くか。車を持っていない学生には、夜の移動がいちばんの壁だと思います。",
        concern: "夜間にバスがなく車を持たない若者が移動できない",
        proposal: "夜間の公共交通の手段を確保してほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 71,
      },
      {
        title: "市の手続きがオンラインで完結しない",
        content:
          "平日に窓口へ行く必要があり負担が大きい。手続きのオンライン化を進めてほしい。",
        source_message_content:
          "手続きのために平日に窓口へ行かないといけないのが地味にきついです。授業を休むことになるので。スマホで完結するものが増えると、それだけで印象が変わると思います。",
        concern: "平日の窓口対応が必要で学業や仕事と両立しにくい",
        proposal: "市の手続きのオンライン化を進めてほしい",
        reasoning_types: ["personal_experience"],
        bill_sentiment: "懸念",
        richness: 67,
      },
    ],
  },
];

const stanceReply: Record<Stance, string> = {
  for: "賛成です。",
  against: "反対です。",
  conditional_for: "条件付きで賛成です。",
  neutral: "判断が難しいです。",
};

/** トピック分析用のセッションを作成（10パターン × 10ループ = 100件） */
export function createTopicAnalysisSessions(
  configId: string
): Omit<InterviewSessionInsert, "id" | "created_at" | "updated_at">[] {
  const now = new Date();
  const sessions: Omit<
    InterviewSessionInsert,
    "id" | "created_at" | "updated_at"
  >[] = [];

  for (let loop = 0; loop < 10; loop++) {
    const baseOffset = loop * 86400000 * 3;

    for (let p = 0; p < opinionPatterns.length; p++) {
      const userNum = loop * opinionPatterns.length + p + 200;
      sessions.push({
        interview_config_id: configId,
        user_id: `00000000-0000-0000-0000-${String(userNum).padStart(12, "0")}`,
        started_at: new Date(
          now.getTime() - baseOffset - (p + 1) * 3600000
        ).toISOString(),
        completed_at: new Date(
          now.getTime() - baseOffset - p * 3600000 - 1800000
        ).toISOString(),
      });
    }
  }

  return sessions;
}

/**
 * トピック分析用のメッセージを作成。
 * 各意見を個別のユーザーメッセージとして作ることで、source_message_id を紐付けられる。
 */
export function createTopicAnalysisMessages(
  sessionIds: string[],
  billName: string
): Omit<InterviewMessageInsert, "id" | "created_at">[] {
  const messages: Omit<InterviewMessageInsert, "id" | "created_at">[] = [];

  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];
    const pattern = opinionPatterns[i % opinionPatterns.length];

    messages.push({
      interview_session_id: sessionId,
      role: "assistant",
      content: `こんにちは。沼津市議会の議案「${billName}」について、率直なご意見をお聞かせください。まず、この予算案に賛成ですか？反対ですか？`,
    });
    messages.push({
      interview_session_id: sessionId,
      role: "user",
      content: stanceReply[pattern.stance],
    });
    messages.push({
      interview_session_id: sessionId,
      role: "assistant",
      content: "そう考える理由と、あなたのお立場を教えてください。",
    });
    for (const opinion of pattern.opinions) {
      messages.push({
        interview_session_id: sessionId,
        role: "user",
        content: opinion.source_message_content,
      });
    }
    messages.push({
      interview_session_id: sessionId,
      role: "assistant",
      content: "ありがとうございました。ご意見を承りました。",
    });
  }

  return messages;
}

/**
 * トピック分析用のレポートを作成（100件、各3意見）。
 * source_message_id は挿入後にしか決まらないため run.ts 側で後付けする。
 */
export function createTopicAnalysisReports(
  sessionIds: string[]
): Omit<InterviewReportInsert, "id" | "created_at" | "updated_at">[] {
  return sessionIds.map((sessionId, index) => {
    const pattern = opinionPatterns[index % opinionPatterns.length];
    return {
      interview_session_id: sessionId,
      stance: pattern.stance,
      summary: pattern.summary,
      role: pattern.role,
      role_title: pattern.role_title,
      role_description: pattern.role_description,
      opinions: pattern.opinions.map((opinion) => toReportOpinion(opinion)),
      is_public_by_user: true,
      is_public_by_admin: index < 30, // 最初の30件は管理者承認済み
    };
  });
}

/**
 * 発言そのものを contextual_quote にする。
 * contextual_quote は「ユーザー発言からの逐語引用」なので、
 * 発言全体をそのまま引用する形にしておけば要件を満たす。
 */
function toReportOpinion(opinion: SeedOpinion) {
  return {
    title: opinion.title,
    content: opinion.content,
    source_message_content: opinion.source_message_content,
    contextual_quote: opinion.source_message_content,
    concern: opinion.concern,
    proposal: opinion.proposal,
    reasoning_types: opinion.reasoning_types,
    bill_sentiment: opinion.bill_sentiment,
    richness: opinion.richness,
  };
}

// =============================================================================
// リアルなインタビューログ（1件、自然な back-and-forth）
//
// opinionPatterns の「まとめて3意見を話す」構造ではなく、
// インタビュアーとの深掘り往復を含む自然な流れで1セッションを作る。
// シミュレーション機能の検証用データとしても使える。
// =============================================================================

const realisticPattern = {
  stance: "conditional_for" as const,
  summary:
    "学童の枠と通学路の安全が手当てされるなら賛成したい。予算の使い道が自分の暮らしとどうつながるのかが分かりにくいのも気になっている。",
  role: "daily_life_affected" as const,
  role_title: "保護者",
  role_description:
    "小学生の子どもを育てながらパートで働く保護者。\n放課後は学童保育を利用している。\n市政の情報は学校からのお便りで知ることが多い。",
  opinions: [
    {
      title: "学童保育の枠と預かり時間が働き方に直結している",
      content:
        "入れるかどうかが直前まで分からず、預かり時間もパートの終業に合わない。定員と時間の見直しを求めている。",
    },
    {
      title: "通学路の側溝と街灯に不安がある",
      content:
        "ふたの外れた側溝や暗い区間があり、冬場の下校時間帯が特に危ない。通学路の点検と改善を求めている。",
    },
    {
      title: "予算の使い道が自分の暮らしとどうつながるか分からない",
      content:
        "資料は公開されていても内容が難しく、身近な話に翻訳された説明がほしいと感じている。",
    },
  ],
} satisfies {
  stance: Stance;
  summary: string;
  role: ReportRole;
  role_title: string;
  role_description: string;
  opinions: Array<{ title: string; content: string }>;
};

const realisticConversation: Array<{
  role: "assistant" | "user";
  content: string;
  /** source_message_id として紐付ける opinions のインデックス。なければ undefined */
  linksToOpinionIndex?: number;
}> = [
  {
    role: "assistant",
    content:
      "こんにちは。沼津市の予算案について、率直なご意見をお聞かせください。まずは、賛成・反対・条件付きで賛成のどれに近いですか？",
  },
  {
    role: "user",
    content: "うーん……条件付きで賛成、ですかね。",
  },
  {
    role: "assistant",
    content:
      "条件付き賛成なのですね。差し支えなければ、お立場と、なぜそう感じているのかをもう少し教えていただけますか？",
  },
  {
    role: "user",
    content:
      "小学生の子どもがいて、パートで働いています。市のお金の使い方って、正直そんなに詳しくないんですけど。",
  },
  {
    role: "user",
    content:
      "でも、暮らしのなかで「ここ、なんとかならないのかな」と思うことはいくつもあって。それが良くなるなら賛成、という感じです。",
  },
  {
    role: "assistant",
    content: "その「なんとかならないのかな」は、たとえばどんな場面ですか？",
  },
  {
    role: "user",
    content:
      "いちばんは学童ですね。毎年申し込むんですけど、入れるかどうかが直前まで分からなくて。しかもお迎えの時間がパートの終わりに合わないので、結局シフトを短くしています。",
    linksToOpinionIndex: 0,
  },
  {
    role: "assistant",
    content:
      "働き方そのものに影響しているのですね。ほかにも気になっていることはありますか？",
  },
  {
    role: "user",
    content:
      "通学路です。側溝のふたが外れているところがあって、子どもが自転車で落ちかけたことがあるんです。あと冬は暗くなるのが早いので、街灯のない区間が本当に怖い。",
    linksToOpinionIndex: 1,
  },
  {
    role: "assistant",
    content:
      "危ない思いをされたのですね。そうした要望は、これまで市に伝える機会はありましたか？",
  },
  {
    role: "user",
    content:
      "学校を通してお願いしたことはあります。ただ、それがどうなったのかは分からないままで。",
  },
  {
    role: "assistant",
    content:
      "予算の資料自体は市のサイトで公開されているのですが、ご覧になったことはありますか？",
  },
  {
    role: "user",
    content:
      "あ、いえ……見たことないです。あるのは知らなかったかも。",
  },
  {
    role: "assistant",
    content: "もし見るとしたら、どんな形になっていると読めそうですか？",
  },
  {
    role: "user",
    content:
      "数字の表を出されても、たぶん分からないです。「学童が何人分増えます」とか、そういう身近な言い方に直してもらえたら読むと思います。自分の生活とどうつながるのかが分からないと、興味の持ちようがなくて。",
    linksToOpinionIndex: 2,
  },
  {
    role: "assistant",
    content:
      "最後に、この予算で「ここだけは押さえてほしい」というものを一つ挙げるとすると、何になりますか？",
  },
  {
    role: "user",
    content:
      "えー、一つだけ……難しいな。じゃあ、学童ですね。あれが安定しないと、働き方ごと崩れるので。",
  },
  {
    role: "assistant",
    content:
      "ありがとうございました。ここまでの内容をまとめ、レポートを作成します。",
  },
];

export function createRealisticSession(
  configId: string
): Omit<InterviewSessionInsert, "id" | "created_at" | "updated_at"> {
  const now = new Date();
  return {
    interview_config_id: configId,
    // opinionPatterns が 200 番台を使っているので被らない番号にする
    user_id: "00000000-0000-0000-0000-000000000500",
    started_at: new Date(now.getTime() - 40 * 60000).toISOString(),
    completed_at: new Date(now.getTime() - 5 * 60000).toISOString(),
  };
}

export function createRealisticMessages(
  sessionId: string
): Omit<InterviewMessageInsert, "id" | "created_at">[] {
  return realisticConversation.map((turn) => ({
    interview_session_id: sessionId,
    role: turn.role,
    content: turn.content,
  }));
}

/** リアル系セッションのレポート。source_message_id は呼び出し側で後付けする。 */
export function createRealisticReport(
  sessionId: string
): Omit<InterviewReportInsert, "id" | "created_at" | "updated_at"> {
  return {
    interview_session_id: sessionId,
    stance: realisticPattern.stance,
    summary: realisticPattern.summary,
    role: realisticPattern.role,
    role_title: realisticPattern.role_title,
    role_description: realisticPattern.role_description,
    opinions: realisticPattern.opinions.map((o) => ({ ...o })),
    is_public_by_user: true,
    is_public_by_admin: true,
  };
}

/**
 * 会話ログのうち、opinions と紐付く user メッセージの (index, opinionIndex) ペアを返す。
 * run.ts 側で source_message_id を紐付けるために使う。
 */
export function getRealisticSourceMessageLinks(): Array<{
  /** realisticConversation の 0-origin index */
  conversationIndex: number;
  /** opinions 配列の 0-origin index */
  opinionIndex: number;
}> {
  return realisticConversation
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => turn.linksToOpinionIndex !== undefined)
    .map(({ turn, index }) => ({
      conversationIndex: index,
      // biome-ignore lint/style/noNonNullAssertion: filter above guarantees defined
      opinionIndex: turn.linksToOpinionIndex!,
    }));
}
