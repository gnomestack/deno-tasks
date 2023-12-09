import { InvalidCastException, ProcessException, ps, stderr, stdout } from "../../deps.ts";
import { hbs } from "../../hbs/mod.ts";
import { FireTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, ITaskResult, TaskResult } from "../types.ts";
import { mapFireTask } from "../utils.ts";

export class SshTask extends FireTask {
    run:
        | string
        | ((ctx: IFireTaskExecutionContext) => Promise<string>)
        | ((ctx: IFireTaskExecutionContext) => string);
    shell?: string;

    targets: string[];
    identityFile?: string;
    parallel?: boolean;
    user?: string;
    uses: string;

    constructor() {
        super();
        this.run = "";
        this.targets = [];
        this.uses = "ssh";
    }
}

export async function handleSshTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as SshTask;
    const result = new TaskResult(task);
    result.status = "running";

    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    const name = task.name || task.id;
    if (!(task instanceof SshTask)) {
        throw new InvalidCastException(`Task ${name} is not a SshTask`);
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

    const splat = ["-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null"];

    if (task.shell) {
        splat.push("-t", task.shell);
    }

    if (task.identityFile) {
        splat.push("-i", task.identityFile);
    }

    const targets = task.targets;
    const results: ITaskResult[] = [];
    if (!task.parallel) {
        for (const target of targets) {
            const result2 = new TaskResult(task);
            let t = target;
            if (task.user) {
                t = `${task.user}@${target}`;
            }
            const tmp = splat.concat([t, run]);
            const r = await ps.exec("ssh", tmp, {
                cwd: task.cwd,
                env: task.env,
                signal: ctx.signal,
            });

            if (r.code !== 0) {
                result2.status = "failed";
                result2.error = new ProcessException("ssh", r.code);
                ctx.bus.error(result2.error);
                return result2;
            }

            results.push(result2);
        }
    } else {
        const promises = [];
        for (const target of targets) {
            let t = target;
            if (task.user) {
                t = `${task.user}@${target}`;
            }
            const tmp = splat.concat([t, run]);
            const p = ps.exec("ssh", tmp, {
                cwd: task.cwd,
                env: task.env,
                stdout: "piped",
                stderr: "piped",
                signal: ctx.signal,
            });
            promises.push(p);
        }

        const r = await Promise.all(promises);
        for (const p of r) {
            const result2 = new TaskResult(task);
            await stdout.write(p.stdout);
            if (p.stderr.length > 0) {
                await stderr.write(p.stderr);
            }
            if (p.code !== 0) {
                result2.status = "failed";
                result2.error = new ProcessException("ssh", p.code);
                ctx.bus.error(result2.error);
                return result2;
            }

            results.push(result2);
        }
    }

    if (results.some((r) => r.status === "failed")) {
        result.status = "failed";
        return result;
    }

    return result;
}

registerTaskHandler(
    "ssh",
    (model) => {
        if (model["uses"] && typeof model["uses"] === "string" && model["uses"] === "ssh") {
            return true;
        }

        return false;
    },
    (task) => task instanceof SshTask,
    handleSshTask,
    (model) => {
        const task = new SshTask();

        if (model["with"] && typeof model["with"] === "object") {
            const withObj = model["with"] as Record<string, unknown>;
            if (withObj["targets"]) {
                if (Array.isArray(withObj["targets"])) {
                    task.targets = withObj["targets"] as string[];
                }

                if (typeof withObj["targets"] === "string") {
                    task.targets = [withObj["targets"] as string];
                }
            }

            if (withObj["user"] && typeof withObj["user"] === "string") {
                task.user = withObj["user"] as string;
            }

            if (withObj["identityFile"] && typeof withObj["identityFile"] === "string") {
                task.identityFile = withObj["identityFile"] as string;
            }

            if (withObj["parallel"]) {
                if (typeof withObj["parallel"] === "boolean") {
                    task.parallel = withObj["parallel"] as boolean;
                } else if (typeof withObj["parallel"] === "string") {
                    const parallel = withObj["parallel"] as string;
                    if (parallel === "true") {
                        task.parallel = true;
                    } else if (parallel === "false") {
                        task.parallel = false;
                    }
                }
            }
        }

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
