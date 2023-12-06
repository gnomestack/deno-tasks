import { AnsiWriter, IAnsiWriter } from "../deps.ts";
import { run } from "./run.ts";
import { handleArgs } from "./handle-args.ts";

export * from "./globals.ts";
export { handleArgs, run };
export async function parseAndRun(args: string[], hostWriter?: IAnsiWriter) {
    const options = handleArgs(args, hostWriter ?? new AnsiWriter());
    return await run(options);
}
