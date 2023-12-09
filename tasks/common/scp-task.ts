import { InvalidCastException, ProcessException, ps, stderr, stdout } from "../../deps.ts";
import { FireTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, ITaskResult, TaskResult } from "../types.ts";
import { mapFireTask } from "../utils.ts";

export class ScpTask extends FireTask {
    targets: string[];
    identityFile?: string;
    parallel?: boolean;
    user?: string;
    src: string;
    dest: string;
    uses: string;

    constructor() {
        super();
        this.targets = [];
        this.src = "";
        this.dest = "";
        this.uses = "scp";
    }
}

export async function handleScpTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as ScpTask;
    const result = new TaskResult(task);
    result.status = "running";

    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    const name = task.name || task.id;
    if (!(task instanceof ScpTask)) {
        throw new InvalidCastException(`Task ${name} is not a SshTask`);
    }

    const splat = [task.src, "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null"];

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
                t = `${task.user}@${target}:${task.dest}`;
            } else {
                t = `${target}:${task.dest}`;
            }
            const tmp = splat.concat([t]);
            const r = await ps.exec("scp", tmp, {
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
                t = `${task.user}@${target}:${task.dest}`;
            } else {
                t = `${target}:${task.dest}`;
            }
            const tmp = splat.concat([t]);
            const p = ps.exec("scp", tmp, {
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
    "scp",
    (model) => {
        if (model["uses"] && typeof model["uses"] === "string" && model["uses"] === "scp") {
            return true;
        }

        return false;
    },
    (task) => task instanceof ScpTask,
    handleScpTask,
    (model) => {
        const task = new ScpTask();

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

            if (withObj["src"] && typeof withObj["src"] === "string") {
                task.src = withObj["src"] as string;
            }

            if (withObj["dest"] && typeof withObj["dest"] === "string") {
                task.dest = withObj["dest"] as string;
            }
        }

        return mapFireTask(model, task);
    },
);
