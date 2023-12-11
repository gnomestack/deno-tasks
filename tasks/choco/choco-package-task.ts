import {
    equalsIgnoreCase,
    InvalidCastException,
    isNullOrWhiteSpace,
    isProcessElevated,
    NotSupportedException,
    os,
    PlatformNotSupportedException,
    ps,
    registerExe,
    splitArguments,
} from "../../deps.ts";
import { PackageTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "../types.ts";
import { mapPackageTask, PackageOperationException, splitPackageId } from "../utils.ts";

registerExe("choco", {
    windows: [
        "%ChocolateyInstall%\\bin\\choco.exe",
        "C:\\ProgramData\\chocolatey\\bin\\choco.exe",
    ],
});

export class ChocoPackageTask extends PackageTask {
    constructor(id: string, packages: string[]);
    constructor(id: string, packages: string[], state: "present" | "absent");
    constructor();
    constructor() {
        super();

        switch (arguments.length) {
            case 2:
                this.id = arguments[0];
                this.packages = arguments[1];
                break;

            case 3:
                this.id = arguments[0];
                this.packages = arguments[1];
                this.state = arguments[2];
                break;

            default:
                this.id = "";
                this.packages = [];
                break;
        }

        this.uses = "chocolatey-package";
    }
}

export async function handleChocoPackageTask(ctx: IFireTaskExecutionContext) {
    const task = ctx.task as ChocoPackageTask;
    const result = new TaskResult(task);
    result.status = "running";

    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    if (!os.isWindows) {
        result.status = "skipped";
        result.error = new PlatformNotSupportedException(
            "Chocolatey is only supported on Windows",
        );
        ctx.bus.warn(result.error.message);
        return result;
    }

    if (!isProcessElevated()) {
        result.status = "skipped";
        result.error = new NotSupportedException(
            "Chocolatey requires elevated privileges. Please run Fire as Administrator.",
        );
        ctx.bus.warn(result.error.message);
        return result;
    }

    const name = task.name || task.id;
    if (!(task instanceof ChocoPackageTask)) {
        throw new InvalidCastException(`Task ${name} is not a ChocoTask`);
    }

    for (const n of task.packages) {
        if (ctx.signal.aborted) {
            result.status = "cancelled";
            break;
        }

        const pkg = splitPackageId(n);

        let installed = false;

        const lr = await ps.exec("choco", ["list", "-e", "-r", pkg.id], {
            stdout: "piped",
            stderr: "piped",
            signal: ctx.signal,
        });

        lr.throwOrContinue();
        if (lr.stdoutLines.length > 0) {
            const [name] = lr.stdoutLines[0].split("|");
            installed = equalsIgnoreCase(name, pkg.id);
        }

        if (task.state === "present") {
            if (installed) {
                ctx.bus.info(`Chocolatey package ${pkg.id} is already present.`);
                continue;
            }

            const splat = ["install", pkg.id, "-y"];
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

            const lr = await ps.exec("choco", splat, {
                stdout: "piped",
                stderr: "piped",
                signal: ctx.signal,
            });

            if (lr.code !== 0) {
                throw new PackageOperationException(
                    pkg.id,
                    "install",
                    `choco install ${pkg.id} failed with exit code ${lr.code}`,
                );
            }

            continue;
        }

        if (task.state === "absent") {
            if (!installed) {
                ctx.bus.info(`Chocolatey package ${pkg.id} is already absent.`);
                continue;
            }

            const lr = await ps.exec("choco", ["uninstall", pkg.id, "-y"], {
                stdout: "piped",
                stderr: "piped",
                signal: ctx.signal,
            });

            if (lr.code !== 0) {
                throw new PackageOperationException(
                    pkg.id,
                    "uninstall",
                    `choco uninstall ${pkg.id} failed with exit code ${lr.code}`,
                );
            }
        }
    }

    result.status = "completed";
    return result;
}

registerTaskHandler(
    "chocolatey-package",
    (model) => {
        if (model["uses"]) {
            const uses = model["uses"] as string;
            if (
                equalsIgnoreCase(uses, "chocolatey-package") || equalsIgnoreCase(uses, "choco-package")
            ) {
                return true;
            }
        }

        return false;
    },
    (task) => task instanceof ChocoPackageTask,
    handleChocoPackageTask,
    (model) => {
        const task = new ChocoPackageTask();
        return mapPackageTask(model, task);
    },
);
