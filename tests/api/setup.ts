// Runs before each API test file is imported. API tests need a local MariaDB/MySQL with
// an empty `axis_test` database (see README). They never touch the dev or production DB.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/axis_test";
process.env.DATABASE_POOL_SIZE = "3";
process.env.BETTER_AUTH_SECRET = "test-only-secret-test-only-secret-test-only";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.ALLOWED_EMAIL_DOMAIN = "school.test";
process.env.PROXY_TICKET_SECRET = "test-only-proxy-secret-test-only-proxy-secret";
