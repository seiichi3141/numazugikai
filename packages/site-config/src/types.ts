export const SITE_IDS = ["numazu-city", "shizuoka-pref"] as const;

export type SiteId = (typeof SITE_IDS)[number];

export type HttpsUrl = `https://${string}`;

export type SiteBranding = Readonly<{
  name: string;
  description: string;
}>;

export type SiteJurisdiction = Readonly<{
  kind: "city" | "prefecture";
  name: string;
  councilName: string;
}>;

export type SiteFeatures = Readonly<{
  showComingSoonBills: boolean;
}>;

export type RuntimeExternalLinks = Readonly<{
  report: HttpsUrl;
  councilOfficial: HttpsUrl;
  forkGuidelinesNote: HttpsUrl;
  githubRepository: HttpsUrl;
  upstreamService: HttpsUrl;
}>;

type SiteProfileBase = Readonly<{
  id: SiteId;
  branding: SiteBranding;
  jurisdiction: SiteJurisdiction;
  features: SiteFeatures;
}>;

export type RuntimeReadySiteProfile = SiteProfileBase &
  Readonly<{
    runtime: Readonly<{ status: "ready" }>;
    externalLinks: RuntimeExternalLinks;
  }>;

export type RuntimeBlockedSiteProfile = SiteProfileBase &
  Readonly<{
    runtime: Readonly<{
      status: "blocked";
      reason: string;
    }>;
    externalLinks: Omit<RuntimeExternalLinks, "report"> &
      Readonly<{ report: HttpsUrl | null }>;
  }>;

export type SiteProfile = RuntimeReadySiteProfile | RuntimeBlockedSiteProfile;

export type SiteProfileRegistry = Readonly<{
  [Id in SiteId]: SiteProfile & Readonly<{ id: Id }>;
}>;
