import {
    equalsIgnoreCase,
    InvalidCastException,
    isNullOrWhiteSpace,
    isProcessElevated,
    osRelease,
    PlatformNotSupportedException,
    ps,
    splitArguments,
    startsWithIgnoreCase,
} from "../../deps.ts";
import { PackageTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "../types.ts";
import { mapPackageTask, splitPackageId } from "../utils.ts";

export class AptPackageTask extends PackageTask {
    constructor() {
        super();
        this.uses = "apt";
    }
}

export async function handleAptPackageTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as AptPackageTask;
    const result = new TaskResult(task);
    result.status = "running";

    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    const osr = osRelease();
    const isDebianLike = osr.isDebianLike || osr.isUbuntu;
    if (!isDebianLike) {
        const e = new PlatformNotSupportedException(
            "Apt is only supported on Debian or Debian-like systems.",
        );
        result.error = e;
        result.status = "skipped";
        ctx.bus.warn(e.message);
        return result;
    }

    const name = task.name || task.id;
    if (!(task instanceof AptPackageTask)) {
        throw new InvalidCastException(`Task ${name} is not AptPackageTask`);
    }

    for (const n of task.packages) {
        if (ctx.signal.aborted) {
            result.status = "cancelled";
            break;
        }

        const pkg = splitPackageId(n);

        let installed = false;

        const lr = await ps.exec("apt", ["list", "--installed", "-qq", pkg.id], {
            stdout: "piped",
            stderr: "piped",
            signal: ctx.signal,
        });

        lr.throwOrContinue();
        if (lr.stdoutLines.length > 0) {
            installed = startsWithIgnoreCase(lr.stdoutLines[0], pkg.id);
        }

        let exe = "apt-get";
        if (!isProcessElevated()) {
            ctx.bus.info(`Elevating process to install ${pkg.id}...`);
            exe = "sudo";
        }

        if (task.state === "present") {
            if (installed) {
                ctx.bus.info(`Apt package ${pkg.id} is already present.`);
                continue;
            }

            const splat = exe === "sudo" ? ["-E", "apt-get", "install", "-y"] : ["install", "-y"];

            if (task.with.args) {
                if (typeof task.with.args === "string") {
                    const params = splitArguments(task.with.args);
                    splat.push(...params);
                } else if (Array.isArray(task.with.args)) {
                    splat.push(...task.with.args);
                }
            }

            if (!isNullOrWhiteSpace(pkg.version) && pkg.version !== "latest") {
                splat.push(pkg.id + "=" + pkg.version);
            } else {
                splat.push(pkg.id);
            }

            const lr = await ps.exec(exe, splat, {
                signal: ctx.signal,
            });

            lr.throwOrContinue();

            continue;
        }

        if (task.state === "absent") {
            if (!installed) {
                ctx.bus.info(`Apt package ${pkg.id} is already absent.`);
                continue;
            }

            const splat = exe === "sudo" ? ["-E", "apt-get", "remove", "-y"] : ["remove", "-y"];

            if (task.with.args) {
                if (typeof task.with.args === "string") {
                    const params = splitArguments(task.with.args);
                    splat.push(...params);
                } else if (Array.isArray(task.with.args)) {
                    splat.push(...task.with.args);
                }
            }

            if (!isNullOrWhiteSpace(pkg.version) && pkg.version !== "latest") {
                splat.push(pkg.id + "=" + pkg.version);
            } else {
                splat.push(pkg.id);
            }

            const lr = await ps.exec(exe, splat, {
                signal: ctx.signal,
            });

            lr.throwOrContinue();
        }
    }

    return result;
}

registerTaskHandler(
    "apt-package",
    (model) => {
        if (model["uses"]) {
            const uses = model["uses"] as string;
            if (equalsIgnoreCase(uses, "apt-package")) {
                return true;
            }
        }

        return false;
    },
    (task) => task instanceof AptPackageTask,
    handleAptPackageTask,
    (model) => {
        const task = new AptPackageTask();
        return mapPackageTask(model, task);
    },
);
