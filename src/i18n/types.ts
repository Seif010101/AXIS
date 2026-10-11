// Arabic is the reference locale: these imports type every t("...") call, so a missing
// or misspelled key is a compile error. The i18n unit test keeps the other locales in sync.
import type assessments from "../../messages/ar/assessments.json";
import type auth from "../../messages/ar/auth.json";
import type chat from "../../messages/ar/chat.json";
import type classroom from "../../messages/ar/classroom.json";
import type common from "../../messages/ar/common.json";
import type insights from "../../messages/ar/insights.json";
import type landing from "../../messages/ar/landing.json";
import type library from "../../messages/ar/library.json";
import type nav from "../../messages/ar/nav.json";
import type schools from "../../messages/ar/schools.json";
import type settings from "../../messages/ar/settings.json";
import type shell from "../../messages/ar/shell.json";
import type student from "../../messages/ar/student.json";
import type studio from "../../messages/ar/studio.json";
import type { Locale } from "./config";

export interface AppMessages {
  common: typeof common;
  nav: typeof nav;
  auth: typeof auth;
  shell: typeof shell;
  settings: typeof settings;
  landing: typeof landing;
  classroom: typeof classroom;
  assessments: typeof assessments;
  chat: typeof chat;
  studio: typeof studio;
  student: typeof student;
  library: typeof library;
  schools: typeof schools;
  insights: typeof insights;
}

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: AppMessages;
  }
}
