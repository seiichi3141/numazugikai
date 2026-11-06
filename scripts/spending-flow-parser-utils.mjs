/**
 * 「お金の流れ」試作データ用の解析処理。
 *
 * 沼津市の決算資料PDFを `pdftotext -tsv` にかけた語の座標から表を組み立てる。
 * 折り返しのあるセルを `-layout` の行単位では復元できないため、座標で読む。
 * 解析結果は公式の件数・合計と突き合わせ、一致しなければ例外にする。
 */

// 一部の行は桁区切りなしで印字されている（例: 6852）
const AMOUNT_PATTERN = /^\d[\d,]*$/;

/** 全角数字を半角にし、半角カナなどの表記ゆれを揃える。 */
export function normalizeText(text) {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** `pdftotext -tsv` の出力から語の一覧を取り出す。 */
export function parseTsvWords(tsv) {
  const words = [];
  for (const line of tsv.split("\n").slice(1)) {
    const cells = line.split("\t");
    if (cells[0] !== "5") continue;
    const left = Number(cells[6]);
    const top = Number(cells[7]);
    const width = Number(cells[8]);
    words.push({
      page: Number(cells[1]),
      left,
      top,
      right: left + width,
      text: cells[11] ?? "",
    });
  }
  return words;
}

export function parseAmount(text) {
  return Number(text.replaceAll(",", ""));
}

export function joinCell(words) {
  const sorted = [...words].sort((a, b) =>
    Math.abs(a.top - b.top) > 3 ? a.top - b.top : a.left - b.left
  );
  const joined = sorted.map((word) => word.text).join("");
  return normalizeText(joined);
}

const DEPARTMENTS = [
  "事務局",
  "政策推進部",
  "総務部",
  "財務部",
  "市民福祉部",
  "生活環境部",
  "産業振興部",
  "都市計画部",
  "駅周辺整備部",
  "駅整備部",
  "建設部",
  "教育委員会",
];

/** 部課のセルを部と課に分ける。危機管理課などは資料上で部が空欄である。 */
export function splitOrganization(text) {
  // 縦書きの款名（「民」「費」など）が列の左に重なることがあるため、前方一致にしない
  const department = DEPARTMENTS.find((name) => text.includes(name));
  if (!department) {
    return { department: null, division: text || null };
  }
  const end = text.indexOf(department) + department.length;
  return { department, division: text.slice(end) || null };
}

/**
 * 補助金・負担金・交付金の一覧を解析する。
 *
 * @param words parseTsvWords の結果
 * @param layout 列の開始位置。`category` が無い様式は区分列を持たない
 */
export function parseRecipientRows(words, layout) {
  const rows = [];
  const pages = [...new Set(words.map((word) => word.page))];
  let roundingAdjustmentThousandYen = 0;

  for (const page of pages) {
    const pageWords = words.filter((word) => word.page === page);
    const anchors = pageWords
      .filter((word) => word.left < layout.department - 8)
      .filter((word) => /^\d{1,3}$/.test(word.text))
      .sort((a, b) => a.top - b.top);

    const summaryRows = pageWords.filter((word) =>
      ["金額", "件数"].includes(word.text)
    );
    const adjustmentRows = pageWords.filter((word) =>
      word.text.includes("端数調整")
    );
    const isOnSameRow = (labels, word) =>
      labels.some((label) => Math.abs(label.top - word.top) < 4);
    const amountCandidates = pageWords.filter(
      (word) => word.left >= layout.amount && AMOUNT_PATTERN.test(word.text)
    );
    for (const word of amountCandidates) {
      if (isOnSameRow(adjustmentRows, word)) {
        roundingAdjustmentThousandYen += parseAmount(word.text);
      }
    }
    const amounts = amountCandidates
      .filter((word) => !isOnSameRow(summaryRows, word))
      .filter((word) => !isOnSameRow(adjustmentRows, word))
      .sort((a, b) => a.top - b.top);
    if (amounts.length !== anchors.length) {
      throw new Error(
        `${page}ページの番号と金額の数が合わない: ${anchors.length} / ${amounts.length}`
      );
    }

    // 折り返しのある行は番号と金額の高さがずれるため、両者を含む範囲を1行とする
    const spans = anchors.map((anchor, index) => ({
      anchor,
      amount: amounts[index],
      top: Math.min(anchor.top, amounts[index].top),
      bottom: Math.max(anchor.top, amounts[index].top),
    }));

    spans.forEach((span, index) => {
      const { anchor, amount } = span;
      const previous = spans[index - 1];
      const next = spans[index + 1];
      const lower = previous ? (previous.bottom + span.top) / 2 : span.top - 8;
      const upper = next ? (span.bottom + next.top) / 2 : span.bottom + 12;
      const band = pageWords.filter(
        (word) =>
          word.top >= lower &&
          word.top < upper &&
          word !== anchor &&
          word !== amount &&
          word.left >= layout.department - 3 &&
          !isOnSameRow(adjustmentRows, word)
      );
      const inColumn = (start, end) =>
        band.filter((word) => word.left >= start - 3 && word.left < end - 3);

      const nameStart = layout.name;
      const divisionEnd = layout.category ?? nameStart;
      // 長い部課名は隣の列へはみ出すため、部と課を続けて読んでから分け直す
      const organization = splitOrganization(
        joinCell(inColumn(layout.department, divisionEnd))
      );

      rows.push({
        no: Number(anchor.text),
        department: organization.department,
        division: organization.division,
        category: layout.category
          ? joinCell(inColumn(layout.category, nameStart)) || null
          : null,
        name: joinCell(inColumn(nameStart, layout.recipient)),
        recipient: joinCell(inColumn(layout.recipient, Infinity)) || null,
        amountThousandYen: parseAmount(amount.text),
      });
    });
  }
  return {
    rows: rows.sort((a, b) => a.no - b.no),
    roundingAdjustmentThousandYen,
  };
}

/** 一覧の末尾にある公式の金額・件数を読み取る。 */
export function parseRecipientTotals(words) {
  const findValueRightOf = (label) => {
    const labelWord = words.find((word) => word.text === label);
    if (!labelWord) throw new Error(`${label}の行が見つからない`);
    const value = words.find(
      (word) =>
        word.page === labelWord.page &&
        Math.abs(word.top - labelWord.top) < 4 &&
        word.left > labelWord.left &&
        AMOUNT_PATTERN.test(word.text)
    );
    if (!value) throw new Error(`${label}の値が見つからない`);
    return parseAmount(value.text);
  };
  return {
    amountThousandYen: findValueRightOf("金額"),
    count: findValueRightOf("件数"),
  };
}

/** 一覧が公式の件数・金額と一致することを確かめる。 */
export function assertRecipientTotals(parsed, totals, label) {
  const { rows, roundingAdjustmentThousandYen } = parsed;
  const sum = rows.reduce(
    (total, row) => total + row.amountThousandYen,
    roundingAdjustmentThousandYen
  );
  if (rows.length !== totals.count || sum !== totals.amountThousandYen) {
    throw new Error(
      `${label}が公式の合計と一致しない: ${rows.length}件 ${sum}千円 / 公式 ${totals.count}件 ${totals.amountThousandYen}千円`
    );
  }
}

/** 決算の歳入（`pdftotext -layout`）から款別の収入済額を読み取る。 */
export function parseRevenueItems(layoutText) {
  const items = [];
  for (const line of layoutText.split("\n")) {
    const match = line.match(
      /^\s*(\d{1,2})\s+(\S+)\s+([\d,]+)\s+([\d,]+)\s+(?:△\s*)?[\d,]+\s/
    );
    if (!match) continue;
    items.push({
      code: Number(match[1]),
      name: normalizeText(match[2]),
      amountThousandYen: parseAmount(match[4]),
    });
  }
  return items;
}

const SETTLEMENT_ROW_COUNT = 27;

function groupRows(words) {
  const rows = [];
  for (const word of [...words].sort((a, b) => a.top - b.top)) {
    const row = rows.find((candidate) => Math.abs(candidate.top - word.top) < 4);
    if (row) row.words.push(word);
    else rows.push({ top: word.top, words: [word] });
  }
  return rows;
}

function amountCells(row) {
  return row.words
    .filter((word) => AMOUNT_PATTERN.test(word.text))
    .sort((a, b) => a.right - b.right);
}

function readColumns(row, rightEdges) {
  const values = rightEdges.map(() => 0);
  for (const word of amountCells(row)) {
    let nearest = 0;
    rightEdges.forEach((edge, index) => {
      if (Math.abs(edge - word.right) < Math.abs(rightEdges[nearest] - word.right))
        nearest = index;
    });
    values[nearest] = parseAmount(word.text);
  }
  return values;
}

/**
 * 市政報告書附表の「一般会計歳出決算節別集計表」（見開き2ページ）を解析する。
 *
 * 左ページは1〜6款、右ページは7〜12款と合計を持つ。列の位置はすべて埋まって
 * いる最終の計の行から決める。右ページは金額行が上から順に節へ対応する。
 */
export function parseSettlementMatrix(leftWords, rightWords) {
  const leftRows = groupRows(leftWords);
  const rightRows = groupRows(rightWords);
  const leftTotal = leftRows.find((row) =>
    row.words.some((word) => word.text === "計")
  );
  if (!leftTotal) throw new Error("節別集計表の計の行が見つからない");

  const leftData = leftRows.filter(
    (row) => row.top > 0 && row.top < leftTotal.top && /^(?:\d{1,2})$/.test(
      normalizeText(row.words.sort((a, b) => a.left - b.left)[0].text)
    )
  );
  // 右端の合計列を持つ行だけが金額行。見出しの「11」などを除く
  const grandTotalEdge = Math.max(
    ...rightRows.flatMap((row) => amountCells(row).map((word) => word.right))
  );
  const rightAll = rightRows.filter((row) =>
    amountCells(row).some((word) => word.right > grandTotalEdge - 6)
  );
  const rightData = rightAll.slice(0, SETTLEMENT_ROW_COUNT);
  const rightTotal = rightAll[SETTLEMENT_ROW_COUNT];
  if (leftData.length !== SETTLEMENT_ROW_COUNT || !rightTotal) {
    throw new Error(
      `節の行数が想定と違う: ${leftData.length} / ${rightAll.length}`
    );
  }

  const leftEdges = amountCells(leftTotal).map((word) => word.right);
  const rightEdges = amountCells(rightTotal).map((word) => word.right);
  // 最左列の金額は桁数で左端が変わるが、右端は揃っている
  const leftEdgeTolerance = 6;
  if (leftEdges.length !== 6) {
    throw new Error(`左ページの列数が想定と違う: ${leftEdges.length}`);
  }

  const totals = [
    ...readColumns(leftTotal, leftEdges),
    ...readColumns(rightTotal, rightEdges),
  ];
  const rows = leftData.map((row, index) => {
    const sorted = [...row.words].sort((a, b) => a.left - b.left);
    const amountsOnly = {
      ...row,
      words: row.words.filter(
        (word) => word.right > leftEdges[0] - leftEdgeTolerance
      ),
    };
    const label = normalizeText(
      sorted
        .slice(1)
        .filter((word) => !amountsOnly.words.includes(word))
        .map((word) => word.text)
        .join("")
    ).replaceAll(" ", "");
    return {
      name: label,
      amounts: [
        ...readColumns(amountsOnly, leftEdges),
        ...readColumns(rightData[index], rightEdges),
      ],
    };
  });
  return { rows, totals };
}

/** 節別集計表の行・列がそれぞれ公式の合計と一致することを確かめる。 */
export function assertSettlementMatrix(matrix) {
  const columnCount = matrix.totals.length;
  const grandTotal = matrix.totals[columnCount - 1];
  for (let column = 0; column < columnCount; column += 1) {
    const sum = matrix.rows.reduce((total, row) => total + row.amounts[column], 0);
    if (sum !== matrix.totals[column]) {
      throw new Error(`${column + 1}列目の合計が一致しない: ${sum}`);
    }
  }
  for (const row of matrix.rows) {
    const sum = row.amounts.slice(0, -1).reduce((total, value) => total + value, 0);
    if (sum !== row.amounts[columnCount - 1]) {
      throw new Error(`${row.name}の行合計が一致しない: ${sum}`);
    }
  }
  const columnsSum = matrix.totals
    .slice(0, -1)
    .reduce((total, value) => total + value, 0);
  if (columnsSum !== grandTotal) {
    throw new Error(`款の合計が総額と一致しない: ${columnsSum}`);
  }
}
