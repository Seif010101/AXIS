import { getTranslations } from "next-intl/server";
import { PeoplePage } from "@/components/schools/people-page";
import { navMetadata } from "@/components/shell/page-metadata";
import { requirePageSession } from "@/server/auth/page";

export const generateMetadata = navMetadata("users");

export default async function OwnerUsersPage({ searchParams }: PageProps<"/owner/users">) {
  const ctx = await requirePageSession("owner");
  const t = await getTranslations("schools.people");
  return (
    <PeoplePage
      ctx={ctx}
      scope={{ kind: "directory" }}
      searchParams={await searchParams}
      title={t("directoryTitle")}
      exportName="all-users"
    />
  );
}
