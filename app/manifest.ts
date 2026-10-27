import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Kalinga — Teachers’ Assistant", short_name: "Kalinga", description: "Prepare online, teach with saved lessons offline.", id: "/", start_url: "/", scope: "/", display: "standalone", background_color: "#fffaf2", theme_color: "#187873", icons: [192, 512].map((size) => ({ src: `/offline/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })) };
}
