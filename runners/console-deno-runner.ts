import { dotenv, fs, trim } from "../deps.ts";
import { runJobs } from "../jobs/fire-job.ts";
import { detectJobCycles, flattenJobs, jobs } from "../jobs/job-collection.ts";
import { JobSummaryMessage } from "../jobs/messages.ts";
import { IFireJob } from "../jobs/types.ts";
import { TaskSummaryMessage } from "../tasks/messages.ts";
import { detectTaskCycles, flattenTasks, tasks } from "../tasks/task-collection.ts";
import { runTasks } from "../tasks/task-runner.ts";
import { IFireTask } from "../tasks/types.ts";
import { consoleSink } from "./console-sink.ts";
import { getFireDefaults } from "./globals.ts";
import { importFireDenoFile } from "./import-fire-deno-file.ts";
import { ListJobMessage, ListMessage, ListTaskMessage, VersionMessage } from "./messages.ts";
import { RunnerExecutionContext } from "./runner-execution-context.ts";
import { IRunnerOptions } from "./types.ts";

export async function run(targets: string[], options: IRunnerOptions) {
    const ctx = new RunnerExecutionContext();
    ctx.bus.addListener(consoleSink);

    if (options.version) {
        ctx.bus.send(new VersionMessage(options));
        return 0;
    }

   

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

    const results = await importFireDenoFile(options, ctx.bus);
    if (!results) {
        return 1;
    }

    if (options.list) {
        if (options.job) {
            ctx.bus.send(new ListJobMessage(options, jobs));
        } else if (options.task) {
            ctx.bus.send(new ListTaskMessage(options, tasks));
        } else {
            ctx.bus.send(new ListMessage(options, tasks, jobs));
        }
        return 0;
    }

    const defaults = getFireDefaults();
    for (const [key, value] of Object.entries(defaults)) {
        if (!ctx.defaults[key]) {
            ctx.defaults[key] = value;
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

        if (!options.skipNeeds) {
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
        for (const target of targets) {
            const task = tasks.get(target);
            if (!task) {
                throw new Error(`Job not found: ${target}`);
            }

            selection.push(task);
        }

        if (!options.skipNeeds) {
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
