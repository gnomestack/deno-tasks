import { PsOutput } from "../../deps.ts";
import { FireTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "../types.ts";
import { mapFireTask } from "../utils.ts";

export type DelegateTaskRun = (
    ctx: IFireTaskExecutionContext,
) => Promise<void> | Promise<PsOutput> | Promise<Record<string, unknown>> | void | PsOutput | Record<string, unknown>;

export class DelegateTask extends FireTask {
    run: DelegateTaskRun;

    constructor(id: string, name: string, needs: string[], run: DelegateTaskRun);
    constructor(id: string, needs: string[], run: DelegateTaskRun);
    constructor(id: string, run: DelegateTaskRun);
    constructor();
    constructor() {
        super();

        switch (arguments.length) {
            case 2:
                this.id = arguments[0];
                this.run = arguments[1];
                break;

            case 3:
                this.id = arguments[0];
                this.name = arguments[1];
                this.run = arguments[2];
                break;

            case 4:
                this.id = arguments[0];
                this.name = arguments[1];
                this.needs = arguments[2];
                this.run = arguments[3];
                break;

            default:
                this.id = "";
                this.run = () => {};
                break;
        }
    }
}

export async function handleDelegateTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as DelegateTask;
    const output = task.run(ctx);
    const result = new TaskResult(task);
    let delegateResult: PsOutput | Record<string, unknown> | undefined | void = undefined;
    if (output instanceof Promise) {
        delegateResult = await output;
    } else {
        delegateResult = output;
    }

    if (delegateResult instanceof PsOutput) {
        const model = {
            file: delegateResult.file,
            args: delegateResult.args,
            code: delegateResult.code,
            stdout: delegateResult.stdoutText,
            stderr: delegateResult.stderrText,
        };

        result.outputs = model;
    }

    if (typeof delegateResult === "object") {
        result.outputs = delegateResult as Record<string, unknown>;
    }

    return result;
}

registerTaskHandler(
    "deletgate-task",
    (_model) => {
        // transform to delegate task should not happen
        return false;
    },
    (task) => task instanceof DelegateTask,
    handleDelegateTask,
    (model) => {
        const task = new DelegateTask();

        if (model["run"] && typeof model["run"] === "function") {
            task.run = model["run"] as (
                ctx: IFireTaskExecutionContext,
            ) =>
                | Promise<void>
                | Promise<PsOutput>
                | Promise<Record<string, unknown>>
                | void
                | PsOutput
                | Record<string, unknown>;
        }

        return mapFireTask(model, task);
    },
);
