import { afterEach, describe, expect, it } from "vitest";
import { adminClient, cleanupTestUser } from "../utils";

/**
 * 本家ドメインによる admin ロールの自動付与が廃止されていることを確かめる。
 *
 * フォーク元（国会版・チームみらい運営）では @team-mir.ai の Google ログインに
 * admin を自動付与していた。沼津版は運営主体が別なので、その仕組みが残っていると
 * 本家のドメインを持つ人が管理画面にログインしただけで管理者になる。
 */
describe("本家ドメインの admin 自動付与の廃止", () => {
  const createdUserIds: string[] = [];

  async function createUserWithProvider(
    email: string,
    provider: string
  ): Promise<string> {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { provider, providers: [provider] },
    });
    if (error) throw new Error(`ユーザー作成失敗: ${error.message}`);
    createdUserIds.push(data.user.id);
    return data.user.id;
  }

  /** ロールが1つも付かない場合は roles キー自体が生えないので空配列で受ける。 */
  async function getUserRoles(userId: string): Promise<string[]> {
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error) throw new Error(`ユーザー取得失敗: ${error.message}`);
    return data.user.app_metadata?.roles ?? [];
  }

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupTestUser(id);
    }
    createdUserIds.length = 0;
  });

  it("本家ドメインの Google ログインでも admin にならない", async () => {
    const email = `test-google-${Date.now()}@team-mir.ai`;
    const userId = await createUserWithProvider(email, "google");

    expect(await getUserRoles(userId)).not.toContain("admin");
  });

  it("付与を行う関数そのものが存在しない", async () => {
    // 関数が残っていると、トリガーを外しても手で呼べば付与できてしまう
    const { error } = await adminClient.rpc(
      // biome-ignore lint/suspicious/noExplicitAny: 削除済みの関数を指すため型に無い
      "apply_admin_role_if_eligible" as any,
      { target_user_id: "00000000-0000-0000-0000-000000000000" }
    );

    expect(error).not.toBeNull();
  });

  it("他ドメインの Google ログインも admin にならない", async () => {
    const email = `test-google-${Date.now()}@example.com`;
    const userId = await createUserWithProvider(email, "google");

    expect(await getUserRoles(userId)).not.toContain("admin");
  });
});
