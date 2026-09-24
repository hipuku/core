import type { MetadataRoute } from "next";

// One entry: the sign-in page, which is where "/" lands and the only page a
// visitor without an account can see.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://core.hipuku.dev/sign-in" }];
}
