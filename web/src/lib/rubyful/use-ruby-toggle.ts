import { useEffect, useState } from "react";
import { rubyfulClient } from "./index";

/**
 * ルビ表示の切り替えロジックを管理するカスタムフック
 *
 * このフックはヘッダーまたはPopover内のRubyToggleから使われる。
 * RubyToggleはレスポンシブ表示やPopoverの開閉で存在が変わるため、
 * ページ表示ごとのGAトラッキングはRubyfulInitializer側で行う。
 */
export function useRubyToggle() {
  const [rubyEnabled, setRubyEnabled] = useState(false);

  useEffect(() => {
    // LocalStorageから初期状態を取得
    setRubyEnabled(rubyfulClient.getIsEnabledFromStorage());
  }, []);

  const handleRubyToggle = (checked: boolean) => {
    setRubyEnabled(checked);

    if (checked) {
      rubyfulClient.show();
    } else {
      rubyfulClient.hide();
    }
    // 画面をリロード
    window.location.reload();
  };

  return {
    rubyEnabled,
    handleRubyToggle,
  };
}
