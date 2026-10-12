import { ComingSoon } from "@/components/common/coming-soon";
import { navMetadata } from "@/components/shell/page-metadata";

export const generateMetadata = navMetadata("import");

// Placeholder until the feature area builds this page.
export default function Page() {
  return <ComingSoon item="import" homeHref="/admin" />;
}
