import { ITask, ITaskContext, ITaskState } from "../tasks/interfaces.ts";
import { defaultTimeout } from "./constants.ts";
import { MessageBus } from "./message-bus.ts";
import { ITaskResult } from "./interfaces.ts";
import {
    TaskCancellationMessage,
    TaskEndMessage,
    TaskSkippedMessage,
    TaskStartMessage,
    TaskTimeoutMessage,
    UnhandledErrorMessage,
} from "./messages.ts";
import { dotenv, env, fs, PsOutput, underscore } from "../deps.ts";
import { TaskContext } from "../tasks/task-context.ts";

export function handleTask(
    task: ITask,
    state: ITaskContext,
    timeout = defaultTimeout,
    cancellationToken: AbortSignal,
): Promise<ITaskResult> {
    return new Promise((resolve, reject) => {
        let start = new Date();
        const result: ITaskResult = { status: "ok", task, start, end: new Date() };

        if (cancellationToken.aborted) {
            result.status = "cancelled";
            resolve(result);
        }

        const controller = new AbortController();
        const signal = controller.signal;
        const handle = setTimeout(() => {
            controller?.abort(`Task ${task.id} timed out after ${timeout} seconds`);
        }, timeout * 1000);
        if (signal?.aborted) {
            reject(signal?.reason);
        }

        start = new Date();
        const onAbort = () => {
            clearTimeout(handle);
            resolve({ status: "cancelled", task, start, end: new Date() });
        };
        signal.addEventListener("abort", onAbort, { once: true });

        try {
            const tr = task.run(state, signal);
            if (tr instanceof Promise) {
                tr
                    .then((r) => {
                        if (r !== undefined && r !== null) {
                            if (r instanceof PsOutput) {
                                r.throwOrContinue();
                            }

                            state.task.outputs = r as Record<string, unknown>;
                        }

                        return r;
                    })
                    .then(() => resolve({ status: "ok", task, start, end: new Date() }))
                    .catch((e) => resolve({ status: "failed", task, start, end: new Date(), e }));
            } else {
                clearTimeout(handle);
                signal.removeEventListener("abort", onAbort);
                if (tr !== undefined) {
                    if (tr instanceof PsOutput) {
                        tr.throwOrContinue();
                    }

                    state.task.outputs = tr as Record<string, unknown>;
                }
                resolve({ status: "ok", task, start, end: new Date() });
            }
        } catch (e) {
            resolve({ status: "failed", task, start, end: new Date(), e });
        } finally {
            signal.removeEventListener("abort", onAbort);
            clearTimeout(handle);
            controller.abort();
        }
    });
}

function _u(value: string) {
    return underscore(value).replaceAll(/[:'\/\.]/g, "_");
}

export async function handleTasks(
    tasks: ITask[],
    state: TaskContext,
    messageBus: MessageBus,
    timeout = defaultTimeout,
    cancellationToken: AbortSignal,
) {
    const results: ITaskResult[] = [];
    let failed = false;

    const taskStates = {} as Record<string, unknown>;

    let ctx = new TaskContext(state);
    for (const task of tasks) {
        const lastState = ctx;
        ctx = new TaskContext(state);
        ctx.set("env", lastState.env);
        const taskState: ITaskState = {
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "timeout": task.timeout,
            "deps": task.deps,
            "force": task.force,
            "skip": typeof task.skip === "boolean" ? task.skip : undefined,
            "status": "running",
            "outputs": {},
        };

        const skipProps = [
            "id",
            "name",
            "description",
            "timeout",
            "deps",
            "force",
            "skip",
            "status",
            "outputs",
        ];
        for (const key in task) {
            if (skipProps.includes(key)) {
                continue;
            }
            taskState[key] = task[key];
        }

        taskStates[_u(task.id)] = taskState;
        ctx.set("tasks", taskStates);
        ctx.set("task", taskState);

        const force = task.force ?? false;
        if (cancellationToken.aborted && !force) {
            const result: ITaskResult = {
                status: "cancelled",
                task,
                start: new Date(),
                end: new Date(),
            };
            messageBus.send(new TaskCancellationMessage(result, cancellationToken));
            results.push(result);
            taskState.status = result.status;
            return results;
        }

        if (typeof task.skip !== "undefined") {
            let skip = false;
            if (typeof task.skip === "function") {
                const r = task.skip(ctx);
                if (r instanceof Promise) {
                    skip = await r;
                } else {
                    skip = r;
                }
            } else if (typeof task.skip === "boolean") {
                skip = task.skip;
            }

            taskState.skip = skip;

            if (skip) {
                const result: ITaskResult = {
                    status: "skipped",
                    task: task,
                    start: new Date(),
                    end: new Date(),
                };
                messageBus.send(new TaskSkippedMessage(result));
                results.push(result);
                taskState.status = result.status;
                continue;
            }
        }

        if (failed && !force) {
            const result: ITaskResult = {
                status: "skipped",
                task: task,
                start: new Date(),
                end: new Date(),
            };
            messageBus.send(new TaskSkippedMessage(result));
            results.push(result);
            taskState.status = result.status;
            continue;
        }

        const to = task.timeout ?? timeout ?? defaultTimeout;
        try {
            messageBus.send(new TaskStartMessage(task));
            const result = await handleTask(task, ctx, to, cancellationToken);
            const envFile = env.get("QTR_ENV");
            try {
                if (envFile && await fs.exists(envFile)) {
                    const envContent = await fs.readTextFile(envFile);
                    if (envContent && envContent.length) {
                        const parsed = dotenv.parse(envContent);
                        for (const key in parsed) {
                            ctx.env[key] = parsed[key];
                            env.set(key, parsed[key]);
                        }

                        // zero out content
                        await fs.writeTextFile(envFile, "");
                    }
                }
            } catch (e) {
                messageBus.send(new UnhandledErrorMessage(e));
            }

            results.push(result);
            taskState.status = result.status;
            switch (result.status) {
                case "timeout":
                    messageBus.send(new TaskTimeoutMessage(result, to));
                    break;

                case "cancelled":
                    failed = true;
                    messageBus.send(
                        new TaskCancellationMessage(result, cancellationToken),
                    );
                    return results;

                default:
                    if (result.status === "failed") {
                        failed = true;
                    }
                    messageBus.send(new TaskEndMessage(result));
                    break;
            }
        } catch (e) {
            failed = true;
            const result: ITaskResult = {
                status: "failed",
                task,
                start: new Date(),
                end: new Date(),
                e,
            };
            results.push(result);
            taskState.status = result.status;
            messageBus.send(new TaskEndMessage(result));
        }
    }

    return results;
}
