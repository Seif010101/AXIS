import type { ReactNode } from "react";
import { requirePageSession } from "@/server/auth/page";

// Only roles allowed in the admin area get past this point (see AREA_ACCESS).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageSession("admin");
  return children;
}
