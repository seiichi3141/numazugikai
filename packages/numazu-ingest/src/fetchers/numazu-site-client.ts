import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { normalizeHtmlForContentHash } from "../utils/normalize-html-for-content-hash";

const execFileAsync = promisify(execFile);

const DEFAULT_USER_AGENT =
  "mirai-gikai-numazu/0.1 (+https://github.com/seiichi3141/numazugikai)";

export type FetchedResource = {
  url: string;
  /** 取得内容のSHA-256。前回と同じなら再解析をスキップするために使う */
  contentHash: string;
  etag: string | null;
  lastModified: string | null;
};

export type FetchedText = FetchedResource & { text: string };
export type FetchedPdfDocument = FetchedText & { bytes: Uint8Array };

export type NumazuSiteClientOptions = {
  /** 連続アクセスの間隔（ミリ秒）。相手サイトへの負荷を抑えるため既定で1秒あける */
  minIntervalMs?: number;
  userAgent?: string;
  fetchImpl?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  /** PDFをテキスト化するコマンド。既定は poppler の pdftotext */
  pdfToTextBin?: string;
};

function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * 沼津市議会サイトからHTML/PDFを取得するクライアント。
 *
 * - robots.txt は `/saijyo/` のみ Disallow で、議会ページの取得は許可されている
 * - それでも相手は自治体サイトなので、リクエスト間隔をあけ、
 *   User-Agent に連絡先を入れて素性を明かす
 * - PDFは `pdftotext -layout` でテキスト化してから解析する
 */
export class NumazuSiteClient {
  private readonly minIntervalMs: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pdfToTextBin: string;
  private lastRequestAt = 0;

  constructor(options: NumazuSiteClientOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.pdfToTextBin = options.pdfToTextBin ?? "pdftotext";
  }

  /** HTMLを取得する。文字コードはUTF-8を前提にする（沼津市サイトはUTF-8）。 */
  async fetchHtml(url: string): Promise<FetchedText> {
    const { buffer, headers } = await this.fetchBinary(url);
    const text = new TextDecoder("utf-8").decode(buffer);
    return {
      url,
      text,
      contentHash: sha256(normalizeHtmlForContentHash(text)),
      etag: headers.etag,
      lastModified: headers.lastModified,
    };
  }

  /**
   * PDFを取得し `pdftotext -layout` でテキスト化する。
   * 取得したPDFそのものは一時ファイルに置き、処理後に必ず消す。
   */
  async fetchPdfText(url: string): Promise<FetchedText> {
    const { bytes: _, ...fetched } = await this.fetchPdfDocument(url);
    return fetched;
  }

  /** PDF原本と、同じ原本から生成したlayoutテキストを一度の取得で返す。 */
  async fetchPdfDocument(url: string): Promise<FetchedPdfDocument> {
    const { buffer, headers } = await this.fetchBinary(url);
    const dir = await mkdtemp(join(tmpdir(), "numazu-ingest-"));
    try {
      const pdfPath = join(dir, "source.pdf");
      const txtPath = join(dir, "source.txt");
      await writeFile(pdfPath, buffer);
      await execFileAsync(this.pdfToTextBin, ["-layout", pdfPath, txtPath]);
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(txtPath, "utf-8");
      return {
        url,
        text,
        bytes: buffer,
        contentHash: sha256(buffer),
        etag: headers.etag,
        lastModified: headers.lastModified,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async fetchBinary(url: string): Promise<{
    buffer: Uint8Array;
    headers: { etag: string | null; lastModified: string | null };
  }> {
    await this.throttle();

    const response = await this.fetchImpl(url, {
      headers: { "User-Agent": this.userAgent },
    });
    if (!response.ok) {
      throw new Error(`${url} が ${response.status} を返した`);
    }

    return {
      buffer: new Uint8Array(await response.arrayBuffer()),
      headers: {
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      },
    };
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt > 0 && elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }
}
