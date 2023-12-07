import { FireTask, PackageTask, ResourceTask } from "./fire-tasks.ts";
import { hbs } from "../hbs/mod.ts";
import { IFireTask, IFireTaskExecutionContext } from "./types.ts";
import { SystemException } from "../deps.ts";

export class PackageOperationException extends SystemException {
    override name = "PackageOperationException";

    constructor(
        public readonly packageName: string,
        public readonly operation = "install",
        message?: string,
    ) {
        super(message ?? `Package ${packageName} could not be ${operation}`);
    }
}

export function splitPackageId(packageId: string) {
    if (packageId.includes("@")) {
        const [id, version] = packageId.split("@");
        return { id, version };
    }

    return { id: packageId, version: "latest" };
}

export function mapPackageTask(
    model: Record<string, unknown>,
    task: PackageTask,
): IFireTask {
    mapResourceTask(model, task);

    if (model["packages"] && Array.isArray(model["packages"])) {
        task.packages = model["packages"] as string[];
    }

    return task;
}

export function mapResourceTask(
    model: Record<string, unknown>,
    task: ResourceTask,
): IFireTask {
    mapFireTask(model, task);

    if (model["uses"] && typeof model["uses"] === "string") {
        task.uses = model["uses"];
    }

    if (model["with"] && typeof model["with"] === "object") {
        task.with = model["with"] as Record<string, unknown>;
    }

    if (
        model["state"] && typeof model["state"] === "string" &&
        (model["state"] === "present" || model["state"] === "absent")
    ) {
        task.state = model["state"] as "present" | "absent";
    }

    return task;
}

export function mapFireTask(
    model: Record<string, unknown>,
    task: FireTask,
): IFireTask {
    if (model["id"] && typeof model["id"] === "string") {
        task.id = model["id"];
    }

    if (model["name"] && typeof model["name"] === "string") {
        task.name = model["name"];
    }

    if (model["env"] && typeof model["env"] === "object") {
        task.env = model["env"] as Record<string, string>;
    }

    if (model["timeout"]) {
        const timeout = model["timeout"];
        if ((typeof timeout === "number")) {
            task.timeout = timeout;
        } else if ((typeof timeout === "string")) {
            task.timeout = (ctx: IFireTaskExecutionContext) => {
                const data = {
                    env: ctx.env,
                    outputs: ctx.outputs,
                    task: ctx.task,
                    secrets: ctx.secrets,
                };
                const tpl = hbs.compile(timeout);
                const output = tpl(data);
                const n = parseInt(output);
                if (isNaN(n)) {
                    return 0;
                }

                return n;
            };
        }
    }

    if (model["if"]) {
        const t = model["if"];
        if ((typeof t === "boolean")) {
            task.if = t;
        } else if ((typeof t === "string")) {
            task.if = (ctx: IFireTaskExecutionContext) => {
                const data = {
                    env: ctx.env,
                    outputs: ctx.outputs,
                    task: ctx.task,
                    secrets: ctx.secrets,
                };
                const tpl = hbs.compile(t);
                const output = tpl(data);
                return Boolean(output);
            };
        }
    }

    if (model["continueOnError"]) {
        const t = model["continueOnError"];
        if ((typeof t === "boolean")) {
            task.continueOnError = t;
        } else if ((typeof t === "string")) {
            task.continueOnError = (ctx: IFireTaskExecutionContext) => {
                const data = {
                    env: ctx.env,
                    outputs: ctx.outputs,
                    task: ctx.task,
                    secrets: ctx.secrets,
                };
                const tpl = hbs.compile(t);
                const output = tpl(data);
                return Boolean(output);
            };
        }
    }

    if (model["cwd"] && typeof model["cwd"] === "string") {
        task.cwd = model["cwd"];
    }

    return task;
}
