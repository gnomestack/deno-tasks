import { IPartialRemoteTask, IPartialShellFileTask, IPartialShellTask, ITask, ITaskBuilder, ITaskContext } from "./interfaces.ts";
import { getTasks } from "./task-collection.ts";
import { os, exec, execSync, ps, env, PsOutput } from "../deps.ts";
import { hbs } from "../hbs/mod.ts";
import { IHostSection, Target } from "../yaml/mod.ts";

export function remoteTask(remoteTask: IPartialRemoteTask): ITaskBuilder {
    const tasks = getTasks();
    const wrap = async function (state: ITaskContext, signal?: AbortSignal): Promise<Record<string, unknown>> {
        const task = state.task;

        if (!task["hosts"]) {
            throw new Error("remote task must specify a hosts array");
        }

        const hosts = task["hosts"] as Target[];


        const envData : Record<string, string> = {};
        for(const key in state.env) {
            const value = state.env[key];
            if(typeof value === "string") {
                envData[key] = value;
            }
        }
        

        if (typeof task["with"] === "object") {
            const withSet = task["with"] as Record<string, string | undefined>;
            for(const key in withSet as Record<string, string | undefined>) {
                const value = withSet[key];
                if(typeof value === "string") {
                    if (value.includes("{{") && value.includes("}}")) {
                        const template = hbs.compile(value);
                        const result = template(state);
                        envData[key] = result;
                        continue;
                    }
                    envData[key] = value;
                }
            }
        }

        state = {
            ...state,
            env: envData,
        };

        let script = task["script"] as string;
        if (typeof script !== "string") {
            throw new Error("script must be a string");
        }

        if (script.includes("{{") && script.includes("}}")) {
            const template = hbs.compile(script);
            const result = template(state);
            script = result;
        }

        const splat : string[] = [];
        if (task["shell"]) {
            splat.push("-t", task["shell"] as string);
        }

        splat.push("-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null");

        const promises : Promise<{ host: string, result: PsOutput}>[] = [];
        for(const host of hosts) {
            const args = splat.concat();
            let target = "";
            if (typeof host !== "string") {
                const hostInfo = host as IHostSection;
                if (hostInfo.identity) {
                    args.push("-i", hostInfo.identity);
                }

                if (hostInfo.port) {
                    args.push("-p", hostInfo.port.toString());
                }

                target = hostInfo.host;
                if (target.includes("{{") && target.includes("}}")) {
                    const template = hbs.compile(target);
                    const result = template(state);
                    target = result;
                }

                args.push(`${hostInfo.user}@${target}`);
            }
            else 
            {
                target = host;
                args.push(host);
            }

            args.push(script);


            const sshTask = async () => {
                const p = await ps.exec("ssh", args, { 
                    signal: signal,
                    env: envData,
                });

                return {
                    host: target,
                    result: p,
                };
            }
           

            promises.push(sshTask());
        }
        

        const results = await Promise.all(promises);
        const errors = results.filter((o) => o.result.code !== 0);
        if (errors.length > 0)
            throw new AggregateError(errors.map((o) => new Error(`ssh ${o.host} failed with exit code ${o.result.code}`)));

        const outputs : Record<string, unknown> = {};

        for(const result of results)
        {
            outputs[result.host] = {
                exitCode: result.result.code,
                stdout: result.result.stdout,
                stderr: result.result.stderr,
            };   
        }

        return outputs;
    }

    return tasks.add({
        id: remoteTask.id,
        name: remoteTask.name ?? remoteTask.id,
        description: remoteTask.description,
        deps: remoteTask.deps ?? [],
        timeout: remoteTask.timeout,
        force: remoteTask.force,
        skip: remoteTask.skip,
        run: wrap,
        with: remoteTask.with,
        shell: remoteTask.shell,
        hosts: remoteTask.hosts,
        remote: remoteTask.remote,
        runAs: remoteTask.runAs,
    });
}
