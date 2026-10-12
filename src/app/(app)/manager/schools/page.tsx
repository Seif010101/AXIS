import { ComingSoon } from "@/components/common/coming-soon";
import { navMetadata } from "@/components/shell/page-metadata";

export const generateMetadata = navMetadata("schools");

// Placeholder until the feature area builds this page.
export default function Page() {
  return <ComingSoon item="schools" homeHref="/manager" />;
}
