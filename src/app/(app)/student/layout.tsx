import type { ReactNode } from "react";
import { requirePageSession } from "@/server/auth/page";

// Only roles allowed in the student area get past this point (see AREA_ACCESS).
export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requirePageSession("student");
  return children;
}
