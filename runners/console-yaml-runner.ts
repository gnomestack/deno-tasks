import { dotenv, fs, homeConfigDir, path, ps, trim, YAML } from "../deps.ts";
import { consoleSink } from "./console-sink.ts";
import { VersionMessage } from "./messages.ts";
import { RunnerExecutionContext } from "./runner-execution-context.ts";
import { IRunnerOptions } from "./types.ts";
import { detectTaskCycles, flattenTasks, IFireTask, tasks } from "../tasks/mod.ts";
import { detectJobCycles, FireJob, flattenJobs, IFireJob, jobs, mapJob, runJobs } from "../jobs/mod.ts";
import { findTaskHandlerEntryByModel } from "../tasks/task-handlers.ts";
import { runTasks } from "../tasks/task-runner.ts";
import { TaskSummaryMessage } from "../tasks/messages.ts";
import { JobSummaryMessage } from "../jobs/messages.ts";

async function importYamlFile(fireFile: string, ctx: RunnerExecutionContext) {
    const yaml = await fs.readTextFile(fireFile);
    const fire = YAML.parse(yaml) as Record<string, unknown>;
    const bus = ctx.bus;

    if (typeof fire !== "object") {
        bus.error(new Error(`Invalid fire file: ${fireFile}`));
        return undefined;
    }

    // console.log(fire);

    if (fire["tasks"]) {
        for (const [id, taskModel] of Object.entries(fire["tasks"] as Record<string, Record<string, unknown>>)) {
            if (typeof taskModel !== "object") {
                bus.error(new Error(`Invalid task definition: ${id}`));
                return undefined;
            }

            const entry = findTaskHandlerEntryByModel(taskModel);
            if (!entry) {
                bus.error(new Error(`Invalid task definition: ${id}`));
                return undefined;
            }
            // console.log("entry", entry);

            const task = entry.map(taskModel);
            task.id = id;
            // console.log(task);
            tasks.add(task);
        }
    }

    if (fire["jobs"]) {
        for (const [id, jobModel] of Object.entries(fire["jobs"] as Record<string, Record<string, unknown>>)) {
            if (typeof jobModel !== "object") {
                bus.error(new Error(`Invalid job definition: ${id}`));
                return undefined;
            }

            const job = new FireJob();

            mapJob(jobModel, job);
            // if the id is not overriden by the yaml
            if (job.id === "") {
                job.id = id;
            }
            jobs.add(job);

            if (jobModel["steps"]) {
                if (!Array.isArray(jobModel["steps"])) {
                    bus.error(new Error(`Invalid job definition: ${id}. Steps must be an array `));
                    return undefined;
                }

                const steps = jobModel["steps"] as unknown[];
                for (const step of steps) {
                    if (typeof step === "string") {
                        const task = tasks.get(step);
                        if (!task) {
                            bus.error(new Error(`Invalid job definition: ${id}. Task not found: ${step}`));
                            return undefined;
                        }
                        job.tasks.add(task);
                        continue;
                    }

                    if (typeof step === "object") {
                        const taskModel = step as Record<string, unknown>;
                        const entry = findTaskHandlerEntryByModel(taskModel);
                        if (!entry) {
                            bus.error(new Error(`Invalid task definition: ${id}`));
                            return undefined;
                        }

                        const task = entry.map(taskModel);
                        if (task.id === "") {
                            task.id = job.tasks.length.toString();
                        }
                        job.tasks.add(task);
                    }
                }
            } else {
                bus.error(new Error(`Invalid job definition: ${id}. Missing steps`));
                return undefined;
            }

            jobs.add(job);
        }
    }

    return fire;
}

export async function run(targets: string[], options: IRunnerOptions) {
    const ctx = new RunnerExecutionContext();
    ctx.bus.addListener(consoleSink);

    if (options.version) {
        ctx.bus.send(new VersionMessage(options));
        return 0;
    }

    let fireFile = "";
    if (!options.fireFile) {
        const files = [
            path.resolve(ps.cwd, "fire.yaml"),
            path.resolve(ps.cwd, "fire.yml"),
            path.resolve(ps.cwd, ".fire", "default.yaml"),
            path.resolve(ps.cwd, ".fire", "default.yml"),
            path.resolve(homeConfigDir(), "fire", "default.yaml"),
            path.resolve(homeConfigDir(), ".fire", "default.yml"),
        ];

        for (const file of files) {
            if (await fs.exists(file)) {
                fireFile = file;
                break;
            }
        }

        if (fireFile === "") {
            ctx.bus.error(new Error(`Fire yaml file not found`));
            return 1;
        }
    } else {
        fireFile = options.fireFile;
        if (!path.isAbsolute(fireFile)) {
            fireFile = path.resolve(ps.cwd, fireFile);
        }

        if (
            !fireFile || !await fs.exists(fireFile)
        ) {
            ctx.bus.error(
                new Error(
                    `Fire yaml file not found: ${fireFile}`,
                ),
            );
            return 1;
        }
    }

    await importYamlFile(fireFile, ctx);

    if (options.env) {
        for (const item of options.env) {
            const [key, value] = trim(item, '"').split("=");
            ctx.env[key] = value;
        }
    }

    if (options.envFile) {
        for (const item of options.envFile) {
            if (await fs.exists(item)) {
                const content = await fs.readTextFile(item);
                const env = dotenv.parse(content);
                for (const key of Object.keys(env)) {
                    ctx.env[key] = env[key];
                }
            }
        }
    }

    if (options.job) {
        let selection: IFireJob[] = [];
        for (const target of targets) {
            const job = jobs.get(target);
            if (!job) {
                throw new Error(`Job not found: ${target}`);
            }

            selection.push(job);
        }

        if (!options.skipDeps) {
            const response = flattenJobs(selection, jobs, ctx.bus);
            if (response.failed) {
                return 1;
            }

            selection = response.result;
        }

        const hasCycles = detectJobCycles(selection, jobs, ctx.bus);
        if (hasCycles) {
            return 1;
        }

        const results = await runJobs(selection, ctx);
        ctx.bus.send(new JobSummaryMessage(results));

        return 0;
    } else {
        let selection: IFireTask[] = [];
        // console.log(tasks.toArray());
        for (const target of targets) {
            const task = tasks.get(target);
            if (!task) {
                throw new Error(`Task not found: ${target}`);
            }

            selection.push(task);
        }

        if (!options.skipDeps) {
            const response = flattenTasks(selection, tasks, ctx.bus);
            if (response.failed) {
                return 1;
            }

            selection = response.result;
        }

        const hasCycles = detectTaskCycles(selection, tasks, ctx.bus);
        if (hasCycles) {
            return 1;
        }

        const results = await runTasks(selection, ctx);
        ctx.bus.send(new TaskSummaryMessage(results));
        return 0;
    }
}
