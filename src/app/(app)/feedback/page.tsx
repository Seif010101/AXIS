import { ComingSoon } from "@/components/common/coming-soon";
import { navMetadata } from "@/components/shell/page-metadata";
import { requirePageSession } from "@/server/auth/page";
import { homePath } from "@/server/policy/roles";

export const generateMetadata = navMetadata("feedback");

// Placeholder until the feature area builds this page.
export default async function Page() {
  const { user } = await requirePageSession();
  return <ComingSoon item="feedback" homeHref={homePath(user.role)} />;
}
