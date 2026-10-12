import type { ReactNode } from "react";
import { requirePageSession } from "@/server/auth/page";

// Only roles allowed in the teacher area get past this point (see AREA_ACCESS).
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  await requirePageSession("teacher");
  return children;
}
