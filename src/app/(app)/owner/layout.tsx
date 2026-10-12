import type { ReactNode } from "react";
import { requirePageSession } from "@/server/auth/page";

// Only roles allowed in the owner area get past this point (see AREA_ACCESS).
export default async function OwnerLayout({ children }: { children: ReactNode }) {
  await requirePageSession("owner");
  return children;
}
