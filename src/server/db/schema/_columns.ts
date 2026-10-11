import { sql } from "drizzle-orm";
import { customType, datetime, varchar } from "drizzle-orm/mysql-core";

// Primary/foreign keys are app-generated UUID strings: MySQL and MariaDB have no shared
// native UUID type, and Better Auth also writes string ids.
export const id = (name = "id") => varchar(name, { length: 36 });

export const pk = () =>
  id()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// All timestamps are UTC DATETIME(3); the mysql2 pool is configured with timezone "Z"
// and every connection runs SET time_zone = '+00:00'.
export const timestamp = (name: string) => datetime(name, { mode: "date", fsp: 3 });

// The app supplies the value ($defaultFn) so it never depends on the server's time zone;
// the SQL default only covers rows written outside the app.
export const createdAt = () =>
  timestamp("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$defaultFn(() => new Date());

export const updatedAt = () =>
  timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

// JSON stored as LONGTEXT and (de)serialized here. MariaDB's JSON type is an alias of
// LONGTEXT and the driver returns it as a string, so the native json() column would hand
// back unparsed text there while working on MySQL. This behaves the same on both.
export const json = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => "longtext",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => (typeof value === "string" ? (JSON.parse(value) as T) : (value as T)),
  })(name);
