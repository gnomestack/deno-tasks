import { IPartialDockerTask, ITaskBuilder, ITaskContext } from "./interfaces.ts";
import { getTasks } from "./task-collection.ts";
import { ps, splitArguments } from "../deps.ts";
import { hbs } from "../hbs/mod.ts";
import { cwd } from "https://deno.land/x/gs_std@0.0.1/ps/_base.ts";

export function dockerTask(task: IPartialDockerTask): ITaskBuilder {
    const tasks = getTasks();
    const wrap = async function (state: ITaskContext, signal?: AbortSignal): Promise<Record<string, unknown>> {
        const task = state.task;

        const envData : Record<string, string> = {};

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

        const image = task["image"] as string;
        if (typeof image !== "string") {
            throw new Error("image is required and it must be a string");
        }

        const entrypoint = envData["entrypoint"];
        if (entrypoint) {
            delete envData["entrypoint"];
        }

        const args = task["args"] as string;
        if (typeof args === "string") {
            delete envData["args"];
        }

        let pwd = task["cwd"] as string;
        if (typeof pwd === "string") {
            delete envData["cwd"];
        }
        else 
        {
            pwd = cwd();
        }

        const dockerArgs = splitArguments(args);


        state = {
            ...state,
            env: envData,
        };

        const splat = ["run", "--rm", "--workdir", pwd];

        for(const key in envData) {
            const value = envData[key];
            splat.push("-e", `${key}=${value}`);
        }

        splat.push(image);

        if (entrypoint) {
            splat.push(entrypoint);
        }

        splat.push(...dockerArgs);

        const r = await ps.exec("docker", splat, {
            signal: signal,
        })

        r.throwOrContinue();

        return {
            image: image,
            entrypoint: entrypoint,
            args: dockerArgs,
            exitCode: r.code,
            stdout: r.stdout,
            stderr: r.stderr,
        };
    }

    return tasks.add({
        id: task.id,
        name: task.name ?? task.id,
        description: task.description,
        deps: task.deps ?? [],
        timeout: task.timeout,
        force: task.force,
        skip: task.skip,
        run: wrap,
        with: task.with,
        cwd: task.cwd,
    });
}
