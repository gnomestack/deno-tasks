import { IPartialShellFileTask, IPartialShellTask, ITask, ITaskBuilder, ITaskContext } from "./interfaces.ts";
import { getTasks } from "./task-collection.ts";
import { exec, os, run } from "../deps.ts";

export function shellTask(task: IPartialShellTask): ITaskBuilder;
export function shellTask(
    id: string,
    shell: string,
    script: string,
): ITaskBuilder;
export function shellTask(id: string, script: string): ITaskBuilder;
export function shellTask(): ITaskBuilder {
    const tasks = getTasks();
    const id = arguments[0] as string;
    let shell = os.isWindows ? "powershell" : "bash";
    let script = "";
    switch (arguments.length) {
        case 1: {
            if (!(typeof arguments[0] === "object")) {
                throw new Error(`Excpected object for argument 'task'`);
            }

            const task = arguments[0] as IPartialShellTask;
            const wrap = async function (
                _state: ITaskContext,
                signal?: AbortSignal,
            ): Promise<Record<string, unknown>> {
                const out = await exec(shell, script, {
                    signal: signal,
                });
                out.throwOrContinue();
                return {
                    exitCode: out.code,
                    stdout: out.stdout,
                    stderr: out.stderr,
                } as Record<string, unknown>;
            };
            return tasks.add({
                id: task.id,
                name: task.name ?? task.id,
                description: task.description,
                deps: task.deps ?? [],
                timeout: task.timeout,
                force: task.force,
                skip: task.skip,
                run: wrap,
            });
        }
        case 2:
            script = arguments[1] as string;
            break;
        case 3:
            shell = arguments[1] as string;
            script = arguments[2] as string;
            break;

        default:
            throw new Error("Invalid arguments");
    }

    const wrap = async function (
        _state: ITaskContext,
        signal?: AbortSignal,
    ): Promise<Record<string, unknown>> {
        const out = await exec(shell, script, {
            signal: signal,
        });
        out.throwOrContinue();
        return {
            exitCode: out.code,
            stdout: out.stdout,
            stderr: out.stderr,
        };
    };

    const task: ITask = {
        id,
        name: id,
        description: undefined,
        deps: [],
        timeout: undefined,
        run: wrap,
    };

    return tasks.add(task);
}

export function shellFileTask(task: IPartialShellTask): ITaskBuilder;
export function shellFileTask(id: string, file: string): ITaskBuilder;
export function shellFileTask(
    id: string,
    shell: string,
    file: string,
): ITaskBuilder;
export function shellFileTask(): ITaskBuilder {
    const tasks = getTasks();
    const id = arguments[0] as string;

    let shell = os.isWindows ? "powershell" : "bash";
    let file = "";
    switch (arguments.length) {
        case 1: {
            if (!(typeof arguments[0] === "object")) {
                throw new Error(`Excpected object for argument 'task'`);
            }

            const task = arguments[0] as IPartialShellFileTask;
            const file = task.file;
            shell = task.shell ?? shell;
            if (!shell) {
                const text = Deno.readTextFileSync(file);
                const firstLine = text.split(os.newLine)[0];
                if (firstLine.startsWith("#!")) {
                    const cmd = firstLine.substring(2).trim();
                    const parts = cmd.split(" ").map((s) => s.trim()).filter((s) => s.length > 0);
                    shell = parts[0];
                    if (
                        (shell === "env" || shell === "/usr/bin/env") && parts.length > 1
                    ) {
                        shell = parts[1];
                    }

                    if (shell.endsWith(".exe")) {
                        shell = shell.substring(0, shell.length - 4);
                    }
                }
            }

            const wrap = async function (
                _state: ITaskContext,
                signal?: AbortSignal,
            ): Promise<Record<string, unknown>> {
                const out = await run(shell, file, {
                    signal: signal,
                });
                out.throwOrContinue();
                return {
                    exitCode: out.code,
                    stdout: out.stdout,
                    stderr: out.stderr,
                };
            };

            return tasks.add({
                id: task.id,
                name: task.name ?? task.id,
                description: task.description,
                deps: task.deps ?? [],
                timeout: task.timeout,
                force: task.force,
                skip: task.skip,
                run: wrap,
            });
        }
        case 2:
            {
                file = (arguments[1] as string).trim();
                const text = Deno.readTextFileSync(file);
                const firstLine = text.split("\n")[0];
                if (firstLine.startsWith("#!")) {
                    const cmd = firstLine.substring(2).trim();
                    const parts = cmd.split(" ").map((s) => s.trim()).filter((s) => s.length > 0);
                    shell = parts[0];
                    if (
                        (shell === "env" || shell === "/usr/bin/env") && parts.length > 1
                    ) {
                        shell = parts[1];
                    }

                    if (shell.endsWith(".exe")) {
                        shell = shell.substring(0, shell.length - 4);
                    }
                }
            }
            break;
        case 3:
            shell = arguments[1] as string;
            file = (arguments[2] as string).trim();
            break;

        default:
            throw new Error("Invalid arguments");
    }

    const wrap = async function (
        _state: ITaskContext,
        signal?: AbortSignal,
    ): Promise<void> {
        const out = await run(shell, file, {
            signal: signal,
        });
        out.throwOrContinue();
    };

    const task: ITask = {
        id,
        name: id,
        description: undefined,
        deps: [],
        timeout: undefined,
        run: wrap,
    };

    return tasks.add(task);
}
