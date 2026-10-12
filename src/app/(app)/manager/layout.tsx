import type { ReactNode } from "react";
import { requirePageSession } from "@/server/auth/page";

// Only roles allowed in the manager area get past this point (see AREA_ACCESS).
export default async function ManagerLayout({ children }: { children: ReactNode }) {
  await requirePageSession("manager");
  return children;
}
