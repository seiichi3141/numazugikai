/**
 * ヘッダーのサービス名。
 *
 * 画像ではなく文字で組む。以前は SVG のワードマークを `next/image` に
 * 渡していたが、viewBox（176×25）と描画サイズ（115×21）の縦横比が違い、
 * 収めるために 0.65 倍まで縮んで実効 12px になっていた。
 *
 * 文字で組めば縮尺の食い違いが起きず、ブラウザの文字サイズ設定や拡大にも
 * 追従する。文字を画像にすると拡大でぼやけ、WCAG 1.4.5 にも触れる。
 *
 * 狭い画面では右のナビと競合するので、幅に応じて一段小さくする。
 */
export function SiteTitle() {
  return (
    <span className="flex items-baseline whitespace-nowrap font-bold tracking-tight">
      {/*
        画面幅に応じて滑らかに変える。段階的なブレークポイントだと、
        切り替わる手前の幅で右のナビと競合したり、逆に余白が余ったりする。
      */}
      <span className="text-[clamp(13px,4.3vw,20px)] text-primary">
        みらい議会
      </span>
      <span className="text-[clamp(10px,3.3vw,15px)] text-primary-accent">
        ＠沼津市
      </span>
    </span>
  );
}
