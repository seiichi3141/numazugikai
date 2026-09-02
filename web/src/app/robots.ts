import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { buildRobots } from "@/lib/metadata/utils/build-robots";
import { getPublicBaseUrl } from "@/lib/metadata/utils/get-public-base-url";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(getPublicBaseUrl(env.webUrl));
}
