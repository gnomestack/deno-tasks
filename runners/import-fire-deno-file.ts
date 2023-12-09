import { FileNotFoundExeception, fs, path, ps } from "../deps.ts";
import { IMessageBus } from "../message-bus/mod.ts";
import { UnhandledErrorMessage } from "../message-bus/mod.ts";
import { IRunnerOptions } from "./types.ts";

export async function importFireDenoFile(
    options: IRunnerOptions,
    bus: IMessageBus,
    writeError = true,
) {
    let { fireFile, workingDirectory } = options;
    workingDirectory ??= ps.cwd;
    if (workingDirectory.startsWith("http")) {
        const url = new URL(workingDirectory);
        workingDirectory = url.pathname;
    }

    if (!fireFile) {
        fireFile = `${workingDirectory}/firefile.ts`;
    }

    if (!path.isAbsolute(fireFile)) {
        fireFile = await Deno.realPath(fireFile);
    }

    if (!await fs.exists(fireFile)) {
        fireFile = `${workingDirectory}/.fire/mod.ts`;
    }

    if (!await fs.exists(fireFile)) {
        if (writeError) {
            const error = new FileNotFoundExeception(`Unable to find fire file: ${fireFile}`);
            bus.error(error);
        }
        return false;
    }

    try {
        if (!fireFile.startsWith("http")) {
            fireFile = `file://${fireFile}`;
        }
        await import(fireFile);
    } catch (e) {
        if (e instanceof Error) {
            bus.send(new UnhandledErrorMessage(e));
        } else {
            bus.send(new UnhandledErrorMessage(String(e)));
        }

        return false;
    }

    return true;
}
