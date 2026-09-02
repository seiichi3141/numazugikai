import type { Metadata } from "next";

/**
 * SNS 共有用の metadata をまとめて作る。
 *
 * openGraph と twitter は同じ値の写しになるので、各ページで二重に書かない。
 */
export function buildShareMetadata({
  title,
  description,
  canonical,
  image,
  imageAlt,
  type = "website",
  publishedTime,
  modifiedTime,
}: {
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type,
      ...(type === "article" ? { publishedTime, modifiedTime } : {}),
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
