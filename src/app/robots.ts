import type { MetadataRoute } from "next";

const origin = () => process.env.APP_URL ?? "http://localhost:3300";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/account/", "/api/", "/checkout", "/payment/"],
    },
    sitemap: new URL("/sitemap.xml", origin()).toString(),
  };
}
