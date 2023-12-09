import { InvalidCastException, isNullOrWhiteSpace, os, shell } from "../../deps.ts";
import { hbs } from "../../hbs/mod.ts";
import { FireTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "../types.ts";
import { mapFireTask } from "../utils.ts";

export class ShellTask extends FireTask {
    run:
        | string
        | ((ctx: IFireTaskExecutionContext) => Promise<string>)
        | ((ctx: IFireTaskExecutionContext) => string);
    shell?: string;

    constructor(id: string, run: string);
    constructor(id: string, shell: string, run: string);
    constructor(id: string, deps: string[], shell: string, run: string);
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
                this.shell = arguments[1];
                this.run = arguments[2];
                break;

            case 4:
                this.id = arguments[0];
                this.needs = arguments[1];
                this.shell = arguments[2];
                this.run = arguments[3];
                break;

            default:
                this.id = "";
                this.run = "";
                break;
        }
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

    let shellName = "";
    if (task.shell) {
        shellName = task.shell;
    } else if (
        ctx.defaults.shell && typeof (ctx.defaults.shell) === "string" &&
        !isNullOrWhiteSpace(ctx.defaults.shell)
    ) {
        shellName = ctx.defaults.shell;
        ctx.bus.debug(`Using default shell: ${shellName}`);
    } else {
        shellName = os.isWindows ? "powershell" : "bash";
        ctx.bus.debug(`Using default shell: ${shellName}`);
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

    const r = await shell.exec(shellName, run, {
        cwd: task.cwd,
        env: task.env,
        signal: ctx.signal,
    });

    r.throwOrContinue();
    result.status = "completed";
    result.outputs["code"] = r.code;
    result.outputs["stdout"] = r.stdoutText;
    result.outputs["stderr"] = r.stderrText;
    result.outputs["file"] = r.file;
    result.outputs["args"] = r.args;
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

        if (model["shell"] && typeof model["shell"] === "string") {
            task.shell = model["shell"] as string;
        }

        return mapFireTask(model, task);
    },
);
