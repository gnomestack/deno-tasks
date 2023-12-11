import { equalsIgnoreCase, isNullOrWhiteSpace, isProcessElevated, ps } from "../../deps.ts";
import { PackageTask } from "../fire-tasks.ts";
import { registerTaskHandler } from "../task-handlers.ts";
import { IFireTaskExecutionContext, TaskResult } from "../types.ts";
import { mapPackageTask, splitPackageId } from "../utils.ts";

export class PwshModuleTask extends PackageTask
{
    windows: boolean
    scope?: 'CurrentUser' | 'AllUsers' 

    constructor()
    {
        super();
        this.windows = false;
    }
}

interface Outputs {
    state: 'present' | 'absent';
    name: string;
    version: string;
    scope: 'CurrentUser' | 'AllUsers';
    args: string;
}

export async function handlePwshModuleTask(ctx: IFireTaskExecutionContext)
{
    const task = ctx.task as PwshModuleTask;
    const result = new TaskResult(task);
    result.status = "running";
    if (ctx.signal.aborted) {
        result.status = "cancelled";
        return result;
    }

    const isPrivileged = isProcessElevated();
    task.scope ??= isPrivileged ? 'AllUsers' : 'CurrentUser';

    if (task.scope === 'AllUsers' && !isPrivileged) {
        result.status = "failed";
        result.error = new Error(`Cannot install powershell module for all users without elevated privileges`);
        return result;
    }

    const states :Record<string, Outputs> = {}

    for (const n of task.packages)
    {
        if (ctx.signal.aborted) {
            result.status = "cancelled";
            return result;
        }

        const pkg = splitPackageId(n);
        let exe = "pwsh";
        let installed = false;
        if (task.windows) {
            exe = "powershell";
           
        }
        const splat = [
            "-NoProfile",
            "-NonInteractive",
            "-NoLogo",
            "-ExecutionPolicy", "Bypass",
            "-Command",
            `Get-Module -ListAvailable -Name ${pkg.id} -EA SilentlyContinue`
        ]
        
        const listResult = await ps.exec(
            exe, 
            splat, { 
                stdout: "piped", 
                stderr: "piped", 
                signal: ctx.signal
            });

        installed = listResult.code === 0 && listResult.stdoutLines.length > 0;

        if (task.state === 'present') {
            if (installed) {
                ctx.bus.info(`PowerSehll module ${pkg.id} is already present.`);
                continue;
            }

            splat.length = 0;

            let cmd = `Install-Module -Name ${pkg.id} -Scope ${task.scope} -Force`;

            if (!isNullOrWhiteSpace(pkg.version) && pkg.version !== "latest") {
                cmd += ` -RequiredVersion ${pkg.version}`;
            }

            if (task.with.args) {
                if (typeof task.with.args === "string") {
                    cmd += ` ${task.with.args}`;
                } else if (Array.isArray(task.with.args)) {
                    cmd += ` ${task.with.args.join(" ")}`;
                }
            }


            splat.push(
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy", "Bypass",
                "-Command",
                cmd 
            );

            const lr = await ps.exec(
                exe, 
                splat, { 
                    signal: ctx.signal
                });

            lr.throwOrContinue();
            
            states[pkg.id] = {
                state: 'present',
                name: pkg.id,
                version: pkg.version,
                scope: task.scope,
                args: task.with.args as string ?? "",
            }
        } else {
            if (!installed) {
                ctx.bus.info(`PowerSehll module ${pkg.id} is already absent.`);
                continue;
            }

            splat.length = 0;

            let cmd = `Uninstall-Module -Name ${pkg.id} -Scope ${task.scope} -Force`;

            if (!isNullOrWhiteSpace(pkg.version) && pkg.version !== "latest") {
                cmd += ` -RequiredVersion ${pkg.version}`;
            }

            if (task.with.args) {
                if (typeof task.with.args === "string") {
                    cmd += ` ${task.with.args}`;
                } else if (Array.isArray(task.with.args)) {
                    cmd += ` ${task.with.args.join(" ")}`;
                }
            }


            splat.push(
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy", "Bypass",
                "-Command",
                cmd 
            );

            const lr = await ps.exec(
                exe, 
                splat, { 
                    signal: ctx.signal
                });

            lr.throwOrContinue();
            
            states[pkg.id] = {
                state: 'absent',
                name: pkg.id,
                version: pkg.version,
                scope: task.scope,
                args: task.with.args as string ?? "",
            }
        }
    }


    result.outputs = states;
    result.status = 'completed';
    return result;
}

registerTaskHandler(
    "pwsh-package",
    (model) => {
        if (model["uses"]) {
            const uses = model["uses"] as string;
            if (
                equalsIgnoreCase(uses.trim(), "pwsh-module")
            ) {
                return true;
            }
        }

        return false;
    },
    (task) => task instanceof PwshModuleTask,
    handlePwshModuleTask,
    (model) => {
        const task = new PwshModuleTask();
        mapPackageTask(model, task);

        if (model["with"]) {
            const withArgs = model["with"] as Record<string, unknown>;
            if (withArgs["windows"]) {
                if (typeof withArgs["windows"] === "boolean") {
                    task.windows = withArgs["windows"];
                }

                if (typeof withArgs["windows"] === "string") {
                    task.windows = equalsIgnoreCase(withArgs["windows"], "true");
                }
            }
            
            if (withArgs["scope"]) {
                if (typeof withArgs["scope"] === "string") {
                    task.scope = withArgs["scope"] as 'CurrentUser' | 'AllUsers';
                }
            }
        }

        return task;
    },
);
