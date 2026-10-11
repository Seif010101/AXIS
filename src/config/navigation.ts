import {
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileBarChart,
  FileText,
  Gamepad2,
  GraduationCap,
  Heart,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  MessageSquareHeart,
  NotebookPen,
  Radio,
  School,
  Settings,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/server/policy/roles";
import type { AppMessages } from "@/i18n/types";

// The complete route map of the signed-in app. Every page listed here exists under
// src/app/(app)/. The sidebar renders it as-is; pages never edit it.
// Ownership of each route (which feature area builds it) is in docs/CONVENTIONS.md.

export type NavLabel = keyof AppMessages["nav"]["items"];
export type NavSectionLabel = keyof AppMessages["nav"]["sections"];

export interface NavItem {
  href: string;
  label: NavLabel;
  icon: LucideIcon;
}

export interface NavSection {
  label: NavSectionLabel;
  items: NavItem[];
}

export const navigation: Record<Role, NavSection[]> = {
  student: [
    {
      label: "learn",
      items: [
        { href: "/student", label: "home", icon: LayoutDashboard },
        { href: "/student/chat", label: "tutor", icon: Bot },
        { href: "/student/homework", label: "homework", icon: ClipboardList },
        { href: "/student/tests", label: "tests", icon: ClipboardCheck },
        { href: "/student/worksheets", label: "worksheets", icon: FileText },
        { href: "/student/games", label: "games", icon: Gamepad2 },
        { href: "/student/library", label: "library", icon: BookOpen },
        { href: "/student/studio", label: "studio", icon: Sparkles },
      ],
    },
    {
      label: "me",
      items: [
        { href: "/student/challenge", label: "challenge", icon: Zap },
        { href: "/student/leaderboard", label: "leaderboard", icon: Trophy },
        { href: "/student/progress", label: "progress", icon: TrendingUp },
        { href: "/student/focus", label: "focus", icon: Timer },
        { href: "/student/wellbeing", label: "wellbeing", icon: Heart },
        { href: "/student/notebook", label: "notebook", icon: NotebookPen },
        { href: "/student/learning-style", label: "learningStyle", icon: Brain },
      ],
    },
  ],
  teacher: [
    {
      label: "teaching",
      items: [
        { href: "/teacher", label: "overview", icon: LayoutDashboard },
        { href: "/teacher/classes", label: "classes", icon: Users },
        { href: "/teacher/homework", label: "homework", icon: ClipboardList },
        { href: "/teacher/tests", label: "tests", icon: ClipboardCheck },
        { href: "/teacher/worksheets", label: "worksheets", icon: FileText },
      ],
    },
    {
      label: "tools",
      items: [
        { href: "/teacher/assistant", label: "assistant", icon: Bot },
        { href: "/teacher/studio", label: "studio", icon: Sparkles },
        { href: "/teacher/library", label: "library", icon: BookOpen },
        { href: "/teacher/notebook", label: "notebook", icon: NotebookPen },
      ],
    },
  ],
  manager: [
    {
      label: "network",
      items: [
        { href: "/manager", label: "overview", icon: LayoutDashboard },
        { href: "/manager/schools", label: "schools", icon: School },
        { href: "/manager/books", label: "books", icon: BookMarked },
        { href: "/manager/advisor", label: "advisor", icon: Lightbulb },
      ],
    },
  ],
  admin: [
    {
      label: "school",
      items: [
        { href: "/admin", label: "overview", icon: LayoutDashboard },
        { href: "/admin/people", label: "people", icon: GraduationCap },
        { href: "/admin/import", label: "import", icon: Upload },
        { href: "/admin/announcements", label: "announcements", icon: Megaphone },
        { href: "/admin/incident", label: "incident", icon: ShieldAlert },
      ],
    },
  ],
  owner: [
    {
      label: "platform",
      items: [
        { href: "/owner", label: "overview", icon: LayoutDashboard },
        { href: "/owner/users", label: "users", icon: Users },
        { href: "/manager/schools", label: "schools", icon: School },
        { href: "/manager/books", label: "books", icon: BookMarked },
        { href: "/owner/ai-cost", label: "aiCost", icon: Coins },
        { href: "/owner/churn", label: "churn", icon: TrendingDown },
        { href: "/owner/broadcast", label: "broadcast", icon: Radio },
        { href: "/owner/feedback", label: "feedbackInbox", icon: Inbox },
        { href: "/owner/reports", label: "reports", icon: FileBarChart },
      ],
    },
  ],
};

// Shown to every role at the bottom of the sidebar.
export const accountNavigation: NavSection = {
  label: "account",
  items: [
    { href: "/notifications", label: "notifications", icon: Bell },
    { href: "/feedback", label: "feedback", icon: MessageSquareHeart },
    { href: "/settings", label: "settings", icon: Settings },
  ],
};
