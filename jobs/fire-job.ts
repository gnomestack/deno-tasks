import { equalsIgnoreCase, isNullOrWhiteSpace, TimeoutException } from "../deps.ts";
import { IExecutionContext } from "../execution/types.ts";
import { hbs } from "../hbs/mod.ts";
import { UnhandledErrorMessage } from "../message-bus/mod.ts";
import { TaskCollection } from "../tasks/task-collection.ts";
import { runTasks } from "../tasks/task-runner.ts";
import { JobExecutionContext } from "./job-execution-context.ts";
import { IFireJob, IFireJobExecutionContext, JobResult } from "./types.ts";

export class FireJob implements IFireJob {
    id: string;
    name?: string | undefined;
    env: Record<string, string>;
    tasks: TaskCollection;
    needs?: string[] | undefined;
    defaults?: Record<string, unknown> | undefined;
    timeout?:
        | number
        | ((ctx: IFireJobExecutionContext) => number)
        | ((ctx: IFireJobExecutionContext) => Promise<number>)
        | undefined;
    if?:
        | boolean
        | ((ctx: IFireJobExecutionContext) => boolean)
        | ((ctx: IFireJobExecutionContext) => Promise<boolean>)
        | undefined;
    continueOnError?:
        | boolean
        | ((ctx: IFireJobExecutionContext) => boolean)
        | ((ctx: IFireJobExecutionContext) => Promise<boolean>)
        | undefined;

    constructor() {
        this.id = "";
        this.env = {};
        this.tasks = new TaskCollection();
    }
}

export async function runJobs(jobs: IFireJob[], ctx: IExecutionContext) {
    const results: JobResult[] = [];
    for (const job of jobs) {
        const nextCtx = new JobExecutionContext(
            job,
            ctx.defaults,
            ctx.bus,
            ctx.outputs,
            ctx.signal,
            ctx.env,
            ctx.secrets,
        );
        const result = await runJob(nextCtx);
        results.push(result);

        const o = {
            tasks: {} as Record<string, unknown>,
        };

        for (const taskResult of result.taskResults) {
            o.tasks[taskResult.task.id] = {
                outputs: taskResult.outputs,
            };
        }

        result.outputs = o;

        let oJobs = ctx.outputs["jobs"] as Record<string, unknown>;
        if (!oJobs) {
            oJobs = {};
            ctx.outputs["jobs"] = oJobs;
        }

        oJobs[job.id] = result.outputs;
    }

    return results;
}

export async function runJob(ctx: IFireJobExecutionContext) {
    const job = ctx.job;

    let timeout = job.timeout;
    let skip = job.if;
    let force = job.continueOnError;
    let timedOut = false;
    let complete = () => {};
    const name = job.name ?? job.id;

    try {
        const model = {
            env: ctx.env,
            secrets: ctx.secrets,
            outputs: ctx.outputs,
            defaults: ctx.defaults,
        };
        for(const k in job.env) {
            if (job.env[k]) {
                let v = job.env[k];
                if (typeof v === 'string' && v.includes('{{')) {
                    v = hbs.compile(v)(model);
                    job.env[k] = v;
                }
            }
        }

        if (typeof timeout === "function") {
            const r = timeout(ctx);
            if (r instanceof Promise) {
                timeout = await r;
            } else {
                timeout = r;
            }
        }

        if (typeof skip === "function") {
            const r = skip(ctx);
            if (r instanceof Promise) {
                skip = await r;
            } else {
                skip = r;
            }
        }

        if (typeof force === "function") {
            const r = force(ctx);
            if (r instanceof Promise) {
                force = await r;
            } else {
                force = r;
            }
        }

        if (timeout && timeout > 0) {
            const controller = new AbortController();
            ctx.signal = controller.signal;

            const handle = setTimeout(() => {
                timedOut = true;
                controller.abort(
                    new TimeoutException(`Job ${name} timed out after ${timeout}ms`),
                );
            }, timeout);

            const abortHandler = () => {
                timedOut = true;
                ctx.bus.warn(`Job ${name} timed out after ${timeout}ms`);
                controller.signal.removeEventListener("abort", abortHandler);
            };

            controller.signal.addEventListener("abort", abortHandler, { once: true });

            complete = () => {
                clearTimeout(handle);
            };
        }

        for (const key in job.env) {
            ctx.env[key] = job.env[key];
        }

        if (job.defaults) {
            for (const key in job.defaults) {
                ctx.defaults[key] = job.defaults[key];
            }
        }

        const result = new JobResult(job);

        const results = await runTasks(job.tasks.toArray(), ctx);
        result.taskResults = results;

        result.outputs = {
            tasks: ctx.outputs,
        };

        result.status = "completed";

        return result;
    } catch (error) {
        const result = new JobResult(job);
        result.status = timedOut ? "cancelled" : "failed";
        result.error = error;
        ctx.bus.send(new UnhandledErrorMessage(error));
        return result;
    } finally {
        complete();
    }
}

export function mapJob(model: Record<string, unknown>, job: IFireJob) {
    if (model["id"] && typeof model["id"] === "string") {
        job.id = model["id"] as string;
    }

    if (model["name"] && typeof model["name"] === "string") {
        job.name = model["name"] as string;
    }

    if (model["description"] && typeof model["description"] === "string") {
        job.description = model["description"] as string;
    }

    if (model["env"] && typeof model["env"] === "object") {
        job.env = model["env"] as Record<string, string>;
    }

    if (model["needs"] && Array.isArray(model["needs"])) {
        job.needs = model["needs"] as string[];
    }

    if (model["timeout"]) {
        if (typeof model["timeout"] === "number") {
            job.timeout = model["timeout"] as number;
        } else if (typeof model["timeout"] === "function") {
            job.timeout = model["timeout"] as (ctx: IFireJobExecutionContext) => number;
        } else if (typeof model["timeout"] === "string") {
            const content = model["timeout"] as string;
            if (!isNullOrWhiteSpace(content)) {
                const tpl = hbs.compile(model["timeout"] as string);
                job.timeout = (ctx: IFireJobExecutionContext) => {
                    const result = tpl(ctx);
                    if (typeof result === "number") {
                        return result;
                    }

                    const value = parseInt(result);
                    if (isNaN(value)) {
                        return 0;
                    }

                    return value;
                };
            }
        }
    }

    if (model["if"]) {
        if (typeof model["if"] === "boolean") {
            job.if = model["if"] as boolean;
        } else if (typeof model["if"] === "function") {
            job.if = model["if"] as (ctx: IFireJobExecutionContext) => boolean;
        } else if (typeof model["if"] === "string") {
            const content = model["if"] as string;
            if (!isNullOrWhiteSpace(content)) {
                const tpl = hbs.compile(model["if"] as string);
                job.if = (ctx: IFireJobExecutionContext) => {
                    const result = tpl(ctx);
                    if (typeof result === "boolean") {
                        return result;
                    }

                    return equalsIgnoreCase(result, "true") || equalsIgnoreCase(result, "1");
                };
            }
        }
    }

    if (model["continueOnError"]) {
        if (typeof model["continueOnError"] === "boolean") {
            job.continueOnError = model["continueOnError"] as boolean;
        } else if (typeof model["continueOnError"] === "function") {
            job.continueOnError = model["continueOnError"] as (ctx: IFireJobExecutionContext) => boolean;
        } else if (typeof model["continueOnError"] === "string") {
            const content = model["continueOnError"] as string;
            if (!isNullOrWhiteSpace(content)) {
                const tpl = hbs.compile(model["continueOnError"] as string);
                job.continueOnError = (ctx: IFireJobExecutionContext) => {
                    const result = tpl(ctx);
                    if (typeof result === "boolean") {
                        return result;
                    }

                    return equalsIgnoreCase(result, "true") || result === "1";
                };
            }
        }
    }
}
