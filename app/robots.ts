import type { MetadataRoute } from "next";

// The only public page is /sign-in: "/" redirects there, and every other route
// is behind a session. The API is never a page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://core.hipuku.dev/sitemap.xml",
  };
}
