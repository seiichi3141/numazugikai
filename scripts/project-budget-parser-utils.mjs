/**
 * 「事業の予算と実績」試作データ用の解析と紐づけ。
 *
 * 予算概要書と主要建設事業一覧表は、資料の合計や財源内訳と突き合わせ、一致しなければ
 * 例外にする。随意契約一覧には突き合わせる合計がない。予算事業と契約・補助金の間に
 * 共通IDはないため、紐づけは名称の一致度による推定であり、公式の対応関係ではない。
 */
import { joinCell, parseAmount } from "./spending-flow-parser-utils.mjs";

/** 令和6年度の予算概要PDFは数字と記号が 0x3EAC ずれた文字として取り出される。 */
export function restoreMisencodedDigits(text) {
  return text.replace(/[㻌-㻥]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x3eac)
  );
}

function removeSpaces(text) {
  return text.replace(/\s+/g, "");
}

const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})*)`;
const HEADING_PATTERN = new RegExp(
  String.raw`^(\s*)(\d{1,2})\s+(\S(?:\s*\S)*?)\s{2,}${AMOUNT}\s+前年度(?:比\s+[\d,]+\s*[増減]|と?同額)`
);
const PURPOSE_PATTERN = new RegExp(
  String.raw`^\s*\d{1,2}\s+\S(?:\s*\S)*?\s*費\s{2,}${AMOUNT}\s`
);
const SECTION_PATTERN = new RegExp(
  String.raw`^\s*○\s*(一\s*般\s*経\s*費|事\s*業\s*費)(?:\s+${AMOUNT})?`
);
const ROW_PATTERN = new RegExp(
  String.raw`^\s*・\s*(.*?)\s{2,}${AMOUNT}(?:\s+（(.*))?$`
);
/** 項と目の見出しは字下げで見分ける。 */
const ITEM_HEADING_INDENT = 8;
/** 折り返した事業名は、この字下げの範囲に短く現れる。 */
const NAME_CONTINUATION = { minIndent: 15, maxIndent: 35, maxLength: 14 };

/** 説明欄の折り返しは、事業名の列より右に現れる。 */
const NOTE_MIN_INDENT = 35;

function closeNote(note) {
  return note.replace(/）\s*$/, "").trim();
}

/** 行の右端の塊が説明欄の続きなら返す。 */
function noteContinuation(line) {
  const body = line.trim();
  if (/^[―－-]\s*\d+/.test(body)) return null;
  const tail = body.split(/\s{2,}/).at(-1);
  return line.lastIndexOf(tail) >= NOTE_MIN_INDENT ? tail : null;
}

/**
 * 予算概要書の1款分（`pdftotext -layout`、財源の列を除いて切り出したもの）を読む。
 * 款の合計は最初の金額行、目ごとの一般経費・事業費は `○` の行から取る。
 */
export function parseBudgetDetail(text) {
  const items = [];
  const sections = [];
  let purposeTotal = null;
  let kou = null;
  let current = null;
  let section = null;
  let row = null;
  let noteOpen = false;

  for (const rawLine of restoreMisencodedDigits(text).split("\n")) {
    const line = rawLine.trimEnd();
    if (purposeTotal === null) {
      const purpose = line.match(PURPOSE_PATTERN);
      if (purpose && !line.includes("前年度比")) {
        purposeTotal = parseAmount(purpose[1]);
        continue;
      }
    }

    const heading = line.match(HEADING_PATTERN);
    if (heading) {
      const name = removeSpaces(heading[3]);
      const amount = parseAmount(heading[4]);
      if (heading[1].length < ITEM_HEADING_INDENT) {
        kou = name;
      } else {
        current = {
          kou,
          moku: name,
          amount,
          general: 0,
          project: 0,
          generalRows: 0,
          projectRows: 0,
        };
        sections.push(current);
      }
      section = null;
      row = null;
      noteOpen = false;
      continue;
    }

    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch && current) {
      section = sectionMatch[1].includes("一") ? "general" : "project";
      // 区分が1つだけの目は `○` の行に金額を印字しない
      current[section] = sectionMatch[2]
        ? parseAmount(sectionMatch[2])
        : current.amount;
      row = null;
      continue;
    }

    const rowMatch = line.match(ROW_PATTERN);
    if (rowMatch && current) {
      // `○` の行がない目は、すべて一般経費として扱う
      if (!section) {
        section = "general";
        current.general = current.amount;
      }
      row = {
        kou: current.kou,
        moku: current.moku,
        section,
        name: removeSpaces(rowMatch[1]),
        amountThousandYen: parseAmount(rowMatch[2]),
        note: closeNote(rowMatch[3] ?? ""),
      };
      noteOpen = Boolean(rowMatch[3]) && !rowMatch[3].includes("）");
      items.push(row);
      current[section === "general" ? "generalRows" : "projectRows"] +=
        row.amountThousandYen;
      continue;
    }

    if (row) {
      const tail = noteOpen ? noteContinuation(line) : null;
      if (tail) {
        row.note = closeNote(`${row.note}${tail}`);
        noteOpen = !tail.includes("）");
      }
      const body = line.trim();
      const indent = line.length - line.trimStart().length;
      const head = body.split(/\s{2,}/)[0];
      const isNameContinuation =
        indent >= NAME_CONTINUATION.minIndent &&
        indent < NAME_CONTINUATION.maxIndent &&
        head.length < NAME_CONTINUATION.maxLength &&
        // 縦書きの見出し「歳出の内訳」の1文字が同じ行に落ちてくる
        head !== "歳" &&
        // 廃目の見出し「△ …（廃目）」は事業名の続きではない
        !head.includes("△") &&
        !/\d{2}/.test(head) &&
        !/^[―－]/.test(head);
      if (isNameContinuation) row.name += removeSpaces(head);
    }
  }
  return { purposeTotal, sections, items };
}

/** 目ごとの内訳と款の合計が一致することを確かめる。 */
export function assertBudgetDetail(parsed, label) {
  if (parsed.purposeTotal === null) {
    throw new Error(`${label}: 款の合計が読めない`);
  }
  for (const section of parsed.sections) {
    // 公債費の元金のように、内訳の行を持たない目がある
    if (section.generalRows + section.projectRows === 0) continue;
    if (
      section.general + section.project !== section.amount ||
      section.generalRows !== section.general ||
      section.projectRows !== section.project
    ) {
      throw new Error(
        `${label} ${section.moku}: 内訳が合わない ${JSON.stringify(section)}`
      );
    }
  }
  const total = parsed.sections.reduce((sum, item) => sum + item.amount, 0);
  if (total !== parsed.purposeTotal) {
    throw new Error(
      `${label}: 目の合計 ${total} が款の合計 ${parsed.purposeTotal} と異なる`
    );
  }
}

const AMOUNT_WORD = /^\d[\d,]*$/;
/** 金額行からこれ以上離れた語は、表の見出しなので事業名に含めない。 */
const MAX_NAME_DISTANCE = 34;

function nearestAnchor(anchors, word) {
  let best = null;
  for (const anchor of anchors) {
    if (anchor.page !== word.page) continue;
    if (
      !best ||
      Math.abs(anchor.top - word.top) < Math.abs(best.top - word.top)
    ) {
      best = anchor;
    }
  }
  return best;
}

function joinName(words) {
  return joinCell(words).replaceAll(" ", "");
}

/**
 * 主要建設事業一覧表を読む。金額の行を基準に、名前は最も近い金額行へ割り当てる。
 * 行の金額は主列、残りの財源列の合計が主列と一致しなければ例外にする。
 */
export function parseConstructionRows(words, layout, label) {
  const cleaned = words.map((word) => ({
    ...word,
    text: restoreMisencodedDigits(word.text),
  }));
  // ページ番号は `― 149 ―` のように、罫線風の記号に挟まれて印字される
  const pageNumberLines = new Set(
    cleaned
      .filter((word) => /^[-―－]$/.test(word.text))
      .map((word) => `${word.page}:${word.top}`)
  );
  const body = cleaned.filter(
    (word) =>
      word.top > layout.bodyTop &&
      !pageNumberLines.has(`${word.page}:${word.top}`)
  );
  const isAmount = (word) =>
    AMOUNT_WORD.test(word.text) &&
    word.left >= layout.nameRight &&
    word.right <= layout.summaryLeft + 1;
  const anchors = body
    .filter((word) => isAmount(word) && word.right <= layout.amountRight)
    .map((word) => ({
      page: word.page,
      top: word.top,
      amount: parseAmount(word.text),
      funding: 0,
      nameWords: [],
    }));

  for (const word of body) {
    if (isAmount(word) && word.right > layout.amountRight) {
      const anchor = nearestAnchor(anchors, word);
      if (anchor) anchor.funding += parseAmount(word.text);
    } else if (word.left >= layout.nameLeft && word.left < layout.nameRight) {
      const anchor = nearestAnchor(anchors, word);
      if (anchor && Math.abs(anchor.top - word.top) <= MAX_NAME_DISTANCE) {
        anchor.nameWords.push(word);
      }
    }
  }

  return anchors
    .sort((a, b) => a.page - b.page || a.top - b.top)
    .map((anchor) => {
      const name = joinName(anchor.nameWords);
      if (anchor.funding !== anchor.amount) {
        throw new Error(
          `${label} ${name}: 財源の合計 ${anchor.funding} が ${anchor.amount} と異なる`
        );
      }
      return { name, amountThousandYen: anchor.amount };
    });
}

const CONTRACT_HEADERS = {
  department: "契約担当部課",
  name: "契約名称",
  party: "契約の相手方",
  amount: "契約金額",
  reason: "随意契約の理由",
};
const CONTRACT_DATE = /^令和\d+年\d+月\d+日$/;
const CONTRACT_AMOUNT = /^[\d,]{5,}/;
const PARTY_NOISE =
  /^(単価契約|想定額)|想定金?額|一食当たり[\d,]+円|[（(]見込[）)].*$|\d[\d,]*円.*$/g;
const PARTY_ADDRESS =
  /(東京都|大阪府|京都府|北海道|静岡県|神奈川県|愛知県|千葉県|埼玉県|(?:沼津|三島|富士|静岡|横浜|名古屋|大阪)市)[^法協会]*\d.*$/;
const ADDRESS_WORD = /^.{0,8}[都道府県市区町村郡].*\d/;
/** 列の見出しは中央寄せなので、本文の左端までの差を引く。 */
const CONTRACT_OFFSETS = { department: 20, amount: 12, reason: 118 };
const REASON_MARGIN = 40;
const NUMBER_MARGIN = { before: 25, after: 3 };

/**
 * 随意契約一覧を読む。行番号は行の縦中央に印字されるため、各語を近い行へ割り当てる。
 * 理由の列は転載しないので読まない。
 */
export function parseContractRows(words) {
  const pages = Map.groupBy(words, (word) => word.page);
  const rows = [];
  let columns = null;

  for (const pageWords of pages.values()) {
    const headers = Object.fromEntries(
      Object.entries(CONTRACT_HEADERS).flatMap(([key, title]) => {
        const word = pageWords.find((item) => item.text === title);
        return word ? [[key, word.left]] : [];
      })
    );
    if (Object.keys(headers).length === Object.keys(CONTRACT_HEADERS).length) {
      columns = {
        department: headers.department - CONTRACT_OFFSETS.department,
        name: (headers.department + headers.name) / 2,
        amount: headers.amount - CONTRACT_OFFSETS.amount,
        reason: headers.reason - CONTRACT_OFFSETS.reason,
      };
    }
    if (!columns) continue;
    const { department, name, amount, reason } = columns;
    const headerTexts = Object.values(CONTRACT_HEADERS);
    const headerBottom = Math.max(
      Number.NEGATIVE_INFINITY,
      ...pageWords
        .filter((word) => headerTexts.includes(word.text))
        .map((word) => word.top)
    );

    const numbers = pageWords
      .filter(
        (word) =>
          /^\d{1,3}$/.test(word.text) &&
          word.left > department - NUMBER_MARGIN.before &&
          word.left < department + NUMBER_MARGIN.after
      )
      .sort((a, b) => a.top - b.top);

    numbers.forEach((number, index) => {
      const upper = index
        ? (numbers[index - 1].top + number.top) / 2
        : Number.NEGATIVE_INFINITY;
      const lower =
        index + 1 < numbers.length
          ? (number.top + numbers[index + 1].top) / 2
          : Number.POSITIVE_INFINITY;
      const cells = { department: [], date: [], amount: [], rest: [] };
      for (const word of pageWords) {
        if (word.top < upper || word.top >= lower || word === number) continue;
        if (word.left < department || word.top <= headerBottom + 2) continue;
        if (word.left >= reason + REASON_MARGIN) continue;
        if (CONTRACT_DATE.test(word.text.normalize("NFKC"))) {
          cells.date.push(word);
        }
        else if (CONTRACT_AMOUNT.test(word.text) && word.left >= amount - 20)
          cells.amount.push(word);
        else if (word.left >= reason) continue;
        else if (word.left < name) cells.department.push(word);
        else cells.rest.push(word);
      }
      // 列幅は資料ごとに違うので、締結日の列を境に名称と相手方を分ける
      const dateLeft = cells.date[0]?.left ?? Number.POSITIVE_INFINITY;
      cells.name = cells.rest.filter((word) => word.left < dateLeft);
      cells.party = cells.rest.filter((word) => word.left >= dateLeft);
      // 住所は相手方名の下に続くので、最初の住所の語より下は読まない
      const addressTop = cells.party.find((word) =>
        ADDRESS_WORD.test(word.text.normalize("NFKC"))
      )?.top;
      const partyWords = cells.party.filter(
        (word) => addressTop === undefined || word.top < addressTop
      );
      // 単価と見込総額が並ぶ行があるので、最も大きい額を総額とする
      const amounts = cells.amount.map((word) =>
        parseAmount(word.text.match(CONTRACT_AMOUNT)[0])
      );
      rows.push({
        department: joinName(cells.department),
        name: joinName(cells.name),
        party: joinName(partyWords)
          .replaceAll(PARTY_NOISE, "")
          .replace(PARTY_ADDRESS, ""),
        contractedOn: joinName(cells.date),
        amountYen: amounts.length > 0 ? Math.max(...amounts) : null,
      });
    });
  }
  return rows;
}

const ORGANIZATION_WORDS =
  /株式会社|有限会社|合同会社|合資会社|法人|組合|協会|協議会|医師会|薬剤師会|大学|機構|連合|センター|事業団|公社|財団|社団|生協|㈱|㈲|\(株\)|\(有\)|病院|医院|クリニック|商店|商会|工業|建設|産業|電気|設備|システム|サービス|支店|営業所|支社|店$/;

const MAX_PARTY_LENGTH = 30;
/** 行の境界で折り返しが切れた「岡支店」のような断片を出さない。 */
const MIN_PARTY_LENGTH = 5;

/**
 * 個人名を出さないため、団体と判別できない相手方は名前を伏せる。
 * 隣の行と混ざって長くなった文字列も、誤った相手方を見せないよう伏せる。
 */
export function isPublishableParty(party) {
  return (
    party.length >= MIN_PARTY_LENGTH &&
    party.length <= MAX_PARTY_LENGTH &&
    ORGANIZATION_WORDS.test(party)
  );
}

const GRAM_SIZE = 3;
const STOP_WORDS = [
  "令和",
  "年度",
  "沼津市",
  "委託",
  "業務",
  "事業",
  "補助金",
  "負担金",
  "交付金",
  "株式会社",
  "一般社団法人",
  "公益財団法人",
];
const NOISE_CHARACTERS = /[\s・･（）()「」、,\d０-９]/g;

/** 定型語で区切った文字3-gramの集合を作る。 */
export function buildGrams(text) {
  let value = (text ?? "").replace(NOISE_CHARACTERS, "");
  for (const word of STOP_WORDS) value = value.replaceAll(word, "|");
  const grams = new Set();
  for (let index = 0; index + GRAM_SIZE <= value.length; index += 1) {
    const gram = value.slice(index, index + GRAM_SIZE);
    if (!gram.includes("|")) grams.add(gram);
  }
  return grams;
}

/** 担当部から候補の款を絞る。判定できない部は絞らない。 */
const PURPOSES_BY_DEPARTMENT = [
  ["市民福祉", ["民生費", "衛生費"]],
  ["生活環境", ["総務費", "衛生費"]],
  ["産業振興", ["労働費", "農林水産業費", "商工費", "総務費"]],
  ["建設部", ["土木費", "災害復旧費"]],
  ["都市計画", ["土木費"]],
  ["駅", ["土木費"]],
  ["教育", ["教育費"]],
  ["危機管理", ["総務費", "消防費"]],
];

function allowedPurposes(department) {
  const entry = PURPOSES_BY_DEPARTMENT.find(([key]) =>
    (department ?? "").includes(key)
  );
  return entry?.[1] ?? null;
}

const MIN_SHARED_GRAMS = 3;
const NAME_WEIGHT = 0.3;
/** 契約額が予算額をこの倍率より超える事業は候補にしない。 */
const BUDGET_TOLERANCE = 1.3;

const itemGramsCache = new WeakMap();

function gramsOf(item) {
  let grams = itemGramsCache.get(item);
  if (!grams) {
    grams = {
      all: buildGrams(`${item.name} ${item.note}`),
      name: buildGrams(item.name),
    };
    itemGramsCache.set(item, grams);
  }
  return grams;
}

/**
 * 問い合わせ文字列に最も近い予算事業を返す。候補がなければ null。
 * `score` は問い合わせの3-gramのうち事業名と説明に含まれる割合に、事業名の一致を加点した値。
 */
export function findBestBudgetItem(items, query, options = {}) {
  const grams = buildGrams(query);
  if (grams.size < MIN_SHARED_GRAMS) return null;
  const purposes = allowedPurposes(options.department);
  let best = null;
  for (const item of items) {
    if (purposes && !purposes.includes(item.purpose)) continue;
    if (
      options.amountThousandYen !== undefined &&
      item.amountThousandYen * BUDGET_TOLERANCE < options.amountThousandYen
    ) {
      continue;
    }
    const itemGrams = gramsOf(item);
    let shared = 0;
    let sharedName = 0;
    for (const gram of grams) {
      if (itemGrams.all.has(gram)) shared += 1;
      if (itemGrams.name.has(gram)) sharedName += 1;
    }
    if (shared < MIN_SHARED_GRAMS) continue;
    const score =
      shared / grams.size +
      (NAME_WEIGHT * sharedName) / Math.max(itemGrams.name.size, 1);
    if (!best || score > best.score) best = { item, score };
  }
  return best;
}

function constructionKey(name) {
  return name.normalize("NFKC").replaceAll("費", "");
}

/**
 * 主要建設事業の決算に当初予算を対応付ける。
 *
 * 一覧表は複数の事業費を1行にまとめることがあるため、概要書の事業と金額が一致するときだけ
 * 事業へ決算を結び付ける。一覧表にない事業は、概要書の同名の事業費を予算とする。
 */
export function mergeConstructions(settlementRows, budgetRows, items) {
  const budgetByName = new Map(
    budgetRows.map((row) => [row.name, row.amountThousandYen])
  );
  const itemsByKey = new Map(
    items.map((item) => [constructionKey(item.name), item])
  );
  return settlementRows.map((row) => {
    const item = itemsByKey.get(constructionKey(row.name)) ?? null;
    const listedBudget = budgetByName.get(row.name) ?? null;
    const isSameScope =
      item !== null &&
      (listedBudget === null || listedBudget === item.amountThousandYen);
    return {
      name: row.name,
      itemId: isSameScope ? item.id : null,
      budgetThousandYen: listedBudget ?? item?.amountThousandYen ?? null,
      settledThousandYen: row.amountThousandYen,
    };
  });
}

/** 契約名から、紐づけの妨げになる括弧書きの分担先などを除く。 */
export function contractQuery(name) {
  return name.replace(/[（(].*?[）)]/g, "");
}
