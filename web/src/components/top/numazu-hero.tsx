import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { Container } from "../layouts/container";
import { Button } from "../ui/button";

export function NumazuHero() {
  return (
    <Container className="pt-24 md:pt-6">
      <section
        aria-labelledby="numazu-hero-heading"
        className="overflow-hidden rounded-3xl border border-mirai-border bg-mirai-surface-accent"
      >
        <div className="grid sm:grid-cols-[1.08fr_0.92fr]">
          <div className="order-last flex flex-col items-start justify-center px-6 py-7 sm:order-first sm:px-8 sm:py-9">
            <p className="mb-2 text-xs font-bold tracking-widest text-primary-accent">
              みらい議会＠沼津市
            </p>
            <h1
              id="numazu-hero-heading"
              className="text-2xl leading-snug font-bold tracking-tight text-mirai-text sm:text-3xl"
            >
              海と富士山を望むまち、沼津。
            </h1>
            <p className="mt-3 max-w-md text-sm leading-7 text-mirai-text-secondary">
              このまちのこれからを決める市議会の動きを、身近な言葉でお届けします。
            </p>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link href={routes.billsList()}>
                議案を見てみる
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="relative order-first min-h-44 sm:order-last sm:min-h-full">
            <Image
              src="/img/bill-thumbnails/tourism-numazu-v1.webp"
              alt="夕暮れの海辺を表現した沼津の風景イメージ"
              fill
              priority
              sizes="(min-width: 500px) 320px, calc(100vw - 32px)"
              className="object-cover"
            />
          </div>
        </div>
      </section>
    </Container>
  );
}
