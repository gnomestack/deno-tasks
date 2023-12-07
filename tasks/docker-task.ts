import { InvalidCastException, isNullOrWhiteSpace, ps, splitArguments, startsWithIgnoreCase } from "../deps.ts";
import { PackageTask } from "./fire-tasks.ts";
import { registerTaskHandler } from "./task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "./types.ts";
import { mapPackageTask } from "./utils.ts";

export class DockerTask extends PackageTask {
    constructor() {
        super();
        this.uses = "apt";
    }
}

export async function handleDockerTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as DockerTask;
    const result = new TaskResult(task);
    result.status = "running";

    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    const name = task.name || task.id;
    if (!(task instanceof DockerTask)) {
        throw new InvalidCastException(`Task ${name} is not DockerTask`);
    }

    const entrypoint = task.with.entrypoint as string;
    const args = task.with.args;
    const cwd = task.cwd ?? ps.cwd;
    const splat: string[] = [
        "run",
        "--rm",
        "--volume",
        `${cwd}:/opt/work`,
        "--workdir",
        `/opt/work`,
    ];

    if (
        entrypoint && typeof entrypoint === "string" &&
        !isNullOrWhiteSpace(entrypoint)
    ) {
        splat.push("--entrypoint", entrypoint);
    }

    if (task.env) {
        for (const [key, value] of Object.entries(task.env)) {
            splat.push("--env", `\"${key}=${value}\"`);
        }
    }

    // docker://
    const image = task.uses.substring(9);
    splat.push(image);

    if (args && Array.isArray(args)) {
        splat.push(...args);
    } else if (args && typeof args === "string") {
        splat.push(...splitArguments(args));
    }

    const lr = await ps.exec("docker", splat, {
        stdout: "piped",
        stderr: "piped",
        signal: ctx.signal,
        cwd: cwd,
        env: task.env,
    });

    lr.throwOrContinue();
    return result;
}

registerTaskHandler(
    "docker",
    (model) => {
        if (model["uses"]) {
            const uses = model["uses"] as string;
            if (startsWithIgnoreCase(uses, "docker://")) {
                return true;
            }
        }

        return false;
    },
    (task) => task instanceof DockerTask,
    handleDockerTask,
    (model) => {
        const task = new DockerTask();
        return mapPackageTask(model, task);
    },
);
