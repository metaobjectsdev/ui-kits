// Ambient types for the tests, which run in Node without @types/node.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
declare const process: { env: Record<string, string | undefined>; cwd(): string };
