import { describe, expect, test } from "bun:test";

const cli = new URL("../../cli/role-snapshot-export.ts", import.meta.url).pathname;
const baseArgs = [
  "bun",
  "run",
  cli,
  "--role-ids",
  "900000000000000001",
  "--owner",
  "0x1111111111111111111111111111111111111111",
  "--dry-run",
];
const env = {
  ...process.env,
  DISCORD_BOT_TOKEN: "test-token-never-used",
  IDENTITY_API_URL: "https://identity.invalid",
};

async function run(args: string[]): Promise<{ exitCode: number; stderr: string }> {
  const child = Bun.spawn(args, { env, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stderr };
}

describe("role-snapshot CLI input validation", () => {
  test("rejects a non-positive or non-numeric freshness value before opening Discord", async () => {
    const result = await run([...baseArgs, "--freshness", "not-a-number"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--freshness must be a positive integer");
  });

  test("does not swallow the next flag as a missing flag value", async () => {
    const result = await run([...baseArgs, "--out", "--community", "thj"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--out requires a value");
  });
});
