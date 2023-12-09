import { InvalidCastException, isNullOrWhiteSpace, ps, splitArguments, startsWithIgnoreCase } from "../../deps.ts";
import { FireTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "../types.ts";
import { mapFireTask } from "../utils.ts";

export class DockerTask extends FireTask {
    uses: string;

    with: Record<string, unknown>;

    constructor(id: string, image: string, args: string[]);
    constructor(id: string, deps: string[], image: string, args: string[]);
    constructor();
    constructor() {
        super();
        this.with ??= {};

        switch (arguments.length) {
            case 3:
                this.id = arguments[0];
                this.with = { entrypoint: arguments[1] };
                this.uses = `docker://${arguments[2]}`;
                break;

            case 4:
                this.id = arguments[0];
                this.needs = arguments[1];
                this.uses = `docker://${arguments[2]}`;
                this.with = { entrypoint: arguments[3] };
                break;

            default:
                this.id = "";
                this.uses = "";
                break;
        }
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
        signal: ctx.signal,
        cwd: cwd,
        env: task.env,
    });

    lr.throwOrContinue();
    result.outputs["code"] = lr.code;
    result.outputs["stdout"] = lr.stdoutText;
    result.outputs["stderr"] = lr.stderrText;
    result.outputs["file"] = lr.file;
    result.outputs["args"] = lr.args;
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

        if (model["uses"]) {
            task.uses = model["uses"] as string;
        }

        if (model["with"] && typeof model["with"] === "object") {
            task.with = model["with"] as Record<string, unknown>;
        }

        return mapFireTask(model, task);
    },
);
