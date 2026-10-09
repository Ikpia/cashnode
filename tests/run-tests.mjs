import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const testDirectory = process.env.CASHNODE_TEST_DIR ?? "tests";
const absoluteTestDirectory = path.resolve(process.cwd(), testDirectory);
const testFiles = readdirSync(absoluteTestDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.mjs"))
  .map((entry) => path.join(testDirectory, entry.name))
  .sort();

if (testFiles.length === 0) {
  console.error(`No test files found in ${testDirectory}.`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "./tests/register-loader.mjs", "--test", "--test-isolation=none", ...testFiles],
  {
    stdio: "inherit",
    shell: false
  }
);

process.exit(result.status ?? 1);
