import { TimeoutException, yellow } from "../deps.ts";
import { IExecutionContext } from "../execution/types.ts";
import { GroupEndMessage, GroupStartMessage } from "../message-bus/mod.ts";
import { FireTask } from "./fire-tasks.ts";
import { TaskExecutionContext } from "./task-execution-context.ts";
import { findTaskHandlerEntryByTask } from "./task-handlers.ts";
import { IFireTaskExecutionContext, ITaskResult, TaskResult } from "./types.ts";

export async function runTasks(tasks: FireTask[], ctx: IExecutionContext) {
    const results: ITaskResult[] = [];
    let failed = false;
    let targetCtx = ctx;
    for (const task of tasks) {
        const nextCtx = new TaskExecutionContext(
            task,
            targetCtx.defaults,
            targetCtx.bus,
            targetCtx.outputs,
            targetCtx.signal,
            targetCtx.env,
            targetCtx.secrets,
        );
        const result = await runTask(nextCtx, failed);
        results.push(result);
        if (result.status === "failed") {
            failed = true;
        }

        ctx.outputs = nextCtx.outputs;
        targetCtx = nextCtx;
    }

    return results;
}

export async function runTask(
    ctx: IFireTaskExecutionContext,
    failed?: boolean,
) {
    let timedOut = false;
    let complete = () => {};
    const task = ctx.task;
    const name = task.name || task.id;
    try {
        if (ctx.signal.aborted) {
            const result = new TaskResult(task);
            result.status = "cancelled";
            return result;
        }
        const start = new Date();

        let skip = task.if;
        let force = task.continueOnError;
        if (typeof skip === "function") {
            const result = skip(ctx);
            if (result instanceof Promise) {
                skip = await result;
            } else {
                skip = result;
            }
        }

        if (typeof force === "function") {
            const result = force(ctx);
            if (result instanceof Promise) {
                force = await result;
            } else {
                force = result;
            }
        }

        if (skip || (failed && !force)) {
            const result = new TaskResult(task);
            result.startAt = start;
            result.endAt = start;
            result.status = "skipped";
            ctx.bus.send(new GroupStartMessage(`${name} (${yellow("skipped")})`));
            return result;
        }

        let timeout = task.timeout;
        if (typeof timeout === "function") {
            const result = timeout(ctx);
            if (result instanceof Promise) {
                timeout = await result;
            } else {
                timeout = result;
            }
        }

        if (timeout && timeout > 0) {
            const controller = new AbortController();
            ctx.signal = controller.signal;

            const handle = setTimeout(() => {
                timedOut = true;
                controller.abort(
                    new TimeoutException(`Task ${task.id} timed out after ${timeout}ms`),
                );
            }, timeout);

            const abortHandler = () => {
                timedOut = true;
                ctx.bus.warn(`Task ${task.id} timed out after ${timeout}ms`);
                controller.signal.removeEventListener("abort", abortHandler);
            };

            complete = () => {
                clearTimeout(handle);
                controller.signal.addEventListener("abort", abortHandler);
            };
        }

        ctx.bus.send(new GroupStartMessage(name));

        const entry = findTaskHandlerEntryByTask(task);
        if (!entry) {
            throw new Error(`No task handler found for task ${task.id}`);
        }

        const result = await entry.handler(ctx);
        if (timedOut) {
            result.status = "cancelled";
        } else {
            result.status = "completed";
        }
        result.startAt = start;
        result.endAt = new Date();
        const o = result.outputs;
        const no = { ...ctx.outputs };
        no[task.id] = {
            outputs: o,
        };
        ctx.outputs = no;
        return result;
    } catch (err) {
        const result = new TaskResult(task);
        if (err instanceof TimeoutException || timedOut) {
            result.status = "cancelled";
        } else {
            result.status = "failed";
        }

        result.error = err;
        ctx.bus.error(err);
        return result;
    } finally {
        ctx.bus.send(new GroupEndMessage(name));
        complete();
    }
}
