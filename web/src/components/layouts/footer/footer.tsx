"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EXTERNAL_LINKS } from "@/config/external-links";
import { isInterviewPage } from "@/lib/page-layout-utils";
import { routes } from "@/lib/routes";
import { policyLinks, primaryLinks } from "./footer.config";

export function Footer() {
  const pathname = usePathname();

  if (isInterviewPage(pathname)) {
    return null;
  }

  return (
    <footer className="bg-mirai-gradient text-mirai-footer-text">
      <div className="mx-auto flex w-full max-w-[500px] flex-col items-center px-6 py-14 pb-20 text-center">
        <FooterLogoSection />
        <FooterPrimaryLinks />
        <FooterPolicies />
        <FooterDisclaimer />
        <FooterCopyright />
      </div>
    </footer>
  );
}

function FooterLogoSection() {
  return (
    <div className="flex flex-col items-center text-center mb-9">
      <Link href={routes.home()} aria-label="みらい議会＠沼津市 トップページ">
        <Image
          src="/img/logo.svg"
          alt="みらい議会＠沼津市"
          width={120}
          height={132}
          className="h-auto"
        />
      </Link>
    </div>
  );
}

function FooterPrimaryLinks() {
  return (
    <nav aria-label="主要リンク" className="w-full mb-5">
      <ul
        className="
      flex flex-col items-center gap-3 text-[14px] font-semibold text-mirai-footer-text
      md:flex-row md:justify-center md:gap-5
      "
      >
        {primaryLinks.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href as Route}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
              className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mirai-footer-text"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterPolicies() {
  return (
    <div className="flex flex-col items-center text-[12px] font-semibold text-mirai-footer-text mb-5">
      <ul className="flex flex-wrap justify-center gap-x-2 gap-y-1">
        {policyLinks.map((policy, index) => (
          <li key={policy.label} className="flex items-center gap-2">
            <Link
              href={policy.href as Route}
              target={policy.external ? "_blank" : undefined}
              rel={policy.external ? "noreferrer" : undefined}
              className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mirai-footer-text"
            >
              {policy.label}
            </Link>
            {index < policyLinks.length - 1 ? <span>｜</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * fork 元との関係を明示する免責。
 *
 * 本家「みらい議会」の FORK_GUIDELINES（AGPL-3.0 第7条に基づく追加条件）が
 * 掲示を必須としている文言なので、消さないこと。
 */
function FooterDisclaimer() {
  return (
    <div className="mb-5 max-w-[420px] text-center text-[12px] leading-relaxed text-mirai-footer-text">
      <p>これは政党チームみらいが運営しているものではありません。</p>
      <p className="mt-1">
        本サービスは
        <Link
          href={EXTERNAL_LINKS.UPSTREAM_SERVICE as Route}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          みらい議会
        </Link>
        を沼津市議会向けに改変した、有志による非公式サービスです。
      </p>
    </div>
  );
}

function FooterCopyright() {
  return (
    <div className="text-center text-sm font-medium text-mirai-footer-text">
      © 2026 みらい議会＠沼津市
    </div>
  );
}
