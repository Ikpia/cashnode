import { pathToFileURL } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const root = pathToFileURL(`${process.cwd()}${path.sep}`).href;

const aliases = new Map([
  ["mongodb", `${root}tests/fakes/mongodb.mjs`],
  ["@/lib/mongodb", `${root}tests/fakes/mongodb.mjs`],
  ["next/server", `${root}tests/fakes/next-server.mjs`],
  ["next/headers", `${root}tests/fakes/next-headers.mjs`],
  ["next/navigation", `${root}tests/fakes/next-navigation.mjs`],
  ["@/lib/auth-session", `${root}tests/fakes/auth-session.mjs`],
  ["@solana/web3.js", `${root}tests/fakes/solana-web3.mjs`]
]);

export async function resolve(specifier, context, nextResolve) {
  if (aliases.has(specifier)) {
    return {
      shortCircuit: true,
      url: aliases.get(specifier)
    };
  }

  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2);
    const candidates = [
      `${relativePath}.ts`,
      `${relativePath}.tsx`,
      `${relativePath}.mjs`,
      `${relativePath}.js`,
      relativePath
    ];
    const resolvedPath = candidates.find((candidate) => existsSync(path.join(process.cwd(), candidate))) ?? relativePath;

    return {
      shortCircuit: true,
      url: `${root}${resolvedPath.replaceAll("\\", "/")}`
    };
  }

  return nextResolve(specifier, context);
}
