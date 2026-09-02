import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { getBillsByCouncilSession } from "@/features/bills/server/loaders/get-bills-by-council-session";
import { CouncilSessionBillList } from "@/features/council-sessions/client/components/council-session-bill-list";
import { getCouncilSessionBySlug } from "@/features/council-sessions/server/loaders/get-council-session-by-slug";
import { routes } from "@/lib/routes";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const session = await getCouncilSessionBySlug(slug);

  if (!session) {
    return { title: "会期が見つかりません" };
  }

  return {
    title: `${session.name}の議案一覧 | みらい議会＠沼津市`,
    description: `${session.name}（${session.start_date}〜${session.end_date}）に提出された議案の一覧です。`,
  };
}

export default async function CouncilSessionBillsPage({ params }: Props) {
  const { slug } = await params;
  const session = await getCouncilSessionBySlug(slug);

  if (!session) {
    notFound();
  }

  const bills = await getBillsByCouncilSession(session.id);

  return (
    <div className="bg-mirai-surface-muted">
      {/* ヒーロー画像 */}
      <div className="relative w-full h-[285px]">
        <Image
          src="/img/archive-hero-7f3d06.png"
          alt={`${session.name}の議案一覧`}
          fill
          priority
          className="object-cover"
          sizes="100vw"
          quality={85}
        />
      </div>

      <Container className="py-8">
        <CouncilSessionBillList session={session} bills={bills} />
      </Container>

      {/* パンくずリスト */}
      <Container className="py-8">
        <Breadcrumb
          items={[
            { label: "トップ", href: routes.home() },
            { label: "定例会の一覧", href: routes.gikaiSessions() },
            { label: session.name },
          ]}
        />
      </Container>
    </div>
  );
}
