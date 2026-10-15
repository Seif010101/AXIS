// Grade/section pickers share one encoding: "grade\u0000section" ('' section = whole grade).

export interface ClassOption {
  grade: string;
  section: string;
}

export interface GradeGroupOption {
  grade: string;
  classes: ClassOption[];
}

const SEPARATOR = "\u0000";

export const encodeClass = (c: ClassOption) => `${c.grade}${SEPARATOR}${c.section}`;

export function decodeClass(value: string): ClassOption {
  const [grade = "", section = ""] = value.split(SEPARATOR);
  return { grade, section };
}

export function flattenClasses(groups: readonly GradeGroupOption[]): ClassOption[] {
  return groups.flatMap((g) => g.classes.map((c) => ({ grade: c.grade, section: c.section })));
}
