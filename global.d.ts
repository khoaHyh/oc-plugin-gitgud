declare const Bun: {
  spawn: (
    command: string[],
    options: {
      cwd: string
      stdin: "ignore"
      stdout: "pipe"
      stderr: "pipe"
      env: Record<string, string | undefined>
    },
  ) => {
    exited: Promise<number>
    stdout: ReadableStream<Uint8Array>
    stderr: ReadableStream<Uint8Array>
  }
}

declare module "bun:ffi" {
  export type Pointer = unknown
}

declare module "bun:test" {
  type TestFn = () => void | Promise<void>
  type Expect = {
    toBe: (expected: unknown) => void
    toEqual: (expected: unknown) => void
    toContain: (expected: unknown) => void
    toBeUndefined: () => void
  }

  export const describe: (name: string, fn: TestFn) => void
  export const expect: (value: unknown) => Expect
  export const test: (name: string, fn: TestFn) => void
}
