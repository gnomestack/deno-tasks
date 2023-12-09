import {
    equalsIgnoreCase,
    InvalidCastException,
    isNullOrWhiteSpace,
    os,
    PlatformNotSupportedException,
    ps,
    registerExe,
    splitArguments,
    startsWithIgnoreCase,
} from "../../deps.ts";
import { PackageTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "../types.ts";
import { mapPackageTask, PackageOperationException, splitPackageId } from "../utils.ts";

registerExe("winget", {
    windows: [
        "%LOCALAPPDATA%\\Microsoft\\WindowsApps\\winget.exe",
    ],
});

export class WinGetPackageTask extends PackageTask {
    constructor() {
        super();
        this.uses = "winget";
    }
}

export async function handleWinGetPackageTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as WinGetPackageTask;
    const result = new TaskResult(task);
    result.status = "running";

    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    if (!os.isWindows) {
        throw new PlatformNotSupportedException(
            "WinGet is only supported on Windows",
        );
    }

    const name = task.name || task.id;
    if (!(task instanceof WinGetPackageTask)) {
        throw new InvalidCastException(`Task ${name} is not a WinGetPackageTask`);
    }

    for (const n of task.packages) {
        if (ctx.signal.aborted) {
            result.status = "cancelled";
            break;
        }
        const pkg = splitPackageId(n);
        let installed = false;

        const lr = await ps.exec("winget", ["list", "-e", pkg.id], {
            stdout: "piped",
            stderr: "piped",
            signal: ctx.signal,
        });

        lr.throwOrContinue();
        if (lr.stdoutLines.length > 0) {
            for (const line of lr.stdoutLines) {
                if (startsWithIgnoreCase(line, pkg.id)) {
                    installed = true;
                    break;
                }
            }
        }

        if (task.state === "present") {
            if (installed) {
                ctx.bus.info(`Winget package ${pkg.id} is already present.`);
                continue;
            }

            const splat = ["install", pkg.id];
            if (!isNullOrWhiteSpace(pkg.version) && pkg.version !== "latest") {
                splat.push("--version", pkg.version);
            }

            if (task.with.args) {
                if (typeof task.with.args === "string") {
                    const params = splitArguments(task.with.args);
                    splat.push(...params);
                } else if (Array.isArray(task.with.args)) {
                    splat.push(...task.with.args);
                }
            }

            const lr = await ps.exec("winget", splat, {
                stdout: "piped",
                stderr: "piped",
                signal: ctx.signal,
            });

            if (lr.code !== 0) {
                throw new PackageOperationException(
                    pkg.id,
                    "install",
                    `winget install ${pkg.id} failed with exit code ${lr.code}`,
                );
            }

            continue;
        }

        if (task.state === "absent") {
            if (!installed) {
                ctx.bus.info(`Winget package ${pkg.id} is already absent.`);
                continue;
            }

            const splat = ["uninstall", pkg.id];
            if (task.with.args) {
                if (typeof task.with.args === "string") {
                    const params = splitArguments(task.with.args);
                    splat.push(...params);
                } else if (Array.isArray(task.with.args)) {
                    splat.push(...task.with.args);
                }
            }

            const lr = await ps.exec("winget", splat, {
                stdout: "piped",
                stderr: "piped",
                signal: ctx.signal,
            });

            if (lr.code !== 0) {
                throw new PackageOperationException(
                    pkg.id,
                    "uninstall",
                    `winget uninstall ${pkg.id} failed with exit code ${lr.code}`,
                );
            }

            continue;
        }
    }
    return result;
}

registerTaskHandler(
    "winget-package",
    (model) => {
        if (model["uses"]) {
            const uses = model["uses"] as string;
            if (equalsIgnoreCase(uses, "winget")) {
                return true;
            }
        }

        return false;
    },
    (task) => task instanceof WinGetPackageTask,
    handleWinGetPackageTask,
    (model) => {
        const task = new WinGetPackageTask();
        return mapPackageTask(model, task);
    },
);
