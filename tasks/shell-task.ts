import { InvalidCastException, isNullOrWhiteSpace, os, shell } from "../deps.ts";
import { hbs } from "../hbs/mod.ts";
import { FireTask } from "./fire-tasks.ts";
import { registerTaskHandler } from "./task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "./types.ts";
import { mapFireTask } from "./utils.ts";

export class ShellTask extends FireTask {
    run:
        | string
        | ((ctx: IFireTaskExecutionContext) => Promise<string>)
        | ((ctx: IFireTaskExecutionContext) => string);
    shell?: string;

    constructor() {
        super();
        this.run = "";
    }
}

export async function handleShellTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as ShellTask;
    const result = new TaskResult(task);
    result.status = "running";

    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    const name = task.name || task.id;
    if (!(task instanceof ShellTask)) {
        throw new InvalidCastException(`Task ${name} is not a ShellTask`);
    }

    if (
        ctx.defaults.shell && typeof (ctx.defaults.shell) === "string" &&
        !isNullOrWhiteSpace(ctx.defaults.shell)
    ) {
        task.shell = ctx.defaults.shell;
        ctx.bus.info(`Using default shell: ${task.shell}`);
    } else {
        task.shell = os.isWindows ? "powershell" : "bash";
        ctx.bus.info(`Using default shell: ${task.shell}`);
    }
    let run = task.run;
    if (typeof run === "function") {
        const result = run(ctx);
        if (result instanceof Promise) {
            run = await result;
        } else {
            run = result;
        }
    }

    const r = await shell.run(task.shell, run, {
        cwd: task.cwd,
        env: task.env,
        signal: ctx.signal,
    });

    r.throwOrContinue();
    result.status = "completed";
    return result;
}

registerTaskHandler(
    "shell",
    (model) => {
        if (model["run"] && typeof model["run"] === "string" && !model["uses"]) {
            return true;
        }

        return false;
    },
    (task) => task instanceof ShellTask,
    handleShellTask,
    (model) => {
        const task = new ShellTask();
        if (model["run"] && typeof model["run"] === "string") {
            const run = model["run"] as string;
            if (run.includes("{{")) {
                task.run = (ctx) => {
                    const model = {
                        env: ctx.env,
                        task: ctx.task,
                        defaults: ctx.defaults,
                        secrets: ctx.secrets,
                    };
                    const tpl = hbs.compile(run);
                    const output = tpl(model);
                    return output;
                };
            } else {
                task.run = run;
            }
        }

        return mapFireTask(model, task);
    },
);
