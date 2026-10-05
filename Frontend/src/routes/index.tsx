import { createFileRoute } from "@tanstack/react-router";
import { ImageAnalysisPlatform } from "@/components/image-analysis-platform";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Omniscient | ISRO Image Analysis" },
      {
        name: "description",
        content:
          "Omniscient is a professional workspace for conversational and time-series geospatial image analysis.",
      },
      { property: "og:title", content: "Omniscient | ISRO Image Analysis" },
      {
        property: "og:description",
        content: "Analyze geospatial imagery through chat and chronological comparison tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ImageAnalysisPlatform />;
}
