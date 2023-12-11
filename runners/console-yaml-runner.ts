import { dotenv, env, fs, homeConfigDir, osRelease, path, ps, trim, YAML } from "../deps.ts";
import { consoleSink } from "./console-sink.ts";
import { ListJobMessage, ListMessage, ListTaskMessage, VersionMessage } from "./messages.ts";
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
        bus.error(new Error(`Invalid fire file: ${fireFile}. Must be a yaml object.`));
        return undefined;
    }

    if (fire["env"]) {
        if (typeof fire["env"] !== "object") {
            bus.warn(`yaml: ${fireFile} - env must be an object`)
        } else {
            for (const [key, value] of Object.entries(fire["env"] as Record<string, unknown>)) {
                if (typeof value !== "string") {
                    throw new Error(`Invalid value for env: ${key} in yaml file: ${fireFile}`);
                }
    
                ctx.env[key] = env.expand(value, {
                    getVariable: function(key) {
                    
                        let v = ctx.secrets[key];
                        if (v === undefined) {
                            v = ctx.env[key];
                        }
    
                        if (v === undefined)
                            v = env.get(key);
    
                        return v;
                    }
                });
            }
        }
    }

    if (fire["defaults"]) {
        if (typeof fire["defaults"] !== "object") {
            bus.warn(`yaml: ${fireFile} - defaults must be an object`)
        } else {
            for (const [key, value] of Object.entries(fire["defaults"] as Record<string, unknown>)) {
                if (typeof value !== "string") {
                    bus.error(new Error(`Invalid defaults definition: ${key}`));
                    return undefined;
                }
    
                ctx.defaults[key] = value;
            }
        }
    }

    if (typeof fire['secrets'] && typeof fire['secrets'] === 'object') {
        if (!fire['vault']) {
            fire['vault'] = {
                'use': 'keepass',
                'create': true
            }
            ctx.bus.debug("Vault not defined, using default which is keepass");
        }

        const mod = await import('./../vault/mod.ts');
        const vault = await mod.handleVaultSection(fire, ctx);
        if (vault === undefined) {
            bus.error(new Error("Invalid vault definition"));
            return undefined;
        }

        await mod.handleSecretSection(fire, vault, ctx);
    }

    // console.log(fire);

    if (fire["tasks"]) {
        for (const [id, taskModel] of Object.entries(fire["tasks"] as Record<string, Record<string, unknown>>)) {
            if (typeof taskModel !== "object") {
                throw new Error(`Task ${id} must be a yaml object.`);
            }

            const entry = findTaskHandlerEntryByModel(taskModel);
            if (!entry) {
                throw new Error(`Task '${id}' has no handler for ${taskModel['uses']}`)
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
                throw new Error(`Job ${id} must be a yaml object.`);
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
                    bus.error(new Error(`Invalid job ${id}. Steps must be an array `));
                    return undefined;
                }

                const steps = jobModel["steps"] as unknown[];
                for (let i = 0; i < steps.length; i++) {
                    const step = steps[i];
                    if (typeof step === "string") {
                        const task = tasks.get(step);
                        if (!task) {
                            throw new Error(`Task '${step}' not found for job '${id}' at step ${i}`)
                        }
                        job.tasks.add(task);
                        continue;
                    }

                    if (typeof step === "object") {
                        const taskModel = step as Record<string, unknown>;
                        const name = taskModel.name || taskModel.id || i.toString();
                        const entry = findTaskHandlerEntryByModel(taskModel);
                        if (!entry) {
                            throw new Error(`Task '${name}' for job '${id}' at step ${i} has no handler for ${taskModel['uses']}`)
                        }

                        const task = entry.map(taskModel);
                        if (task.id === "") {
                            task.id = job.tasks.length.toString();
                        }
                        job.tasks.add(task);
                    }
                }
            } else {
                throw new Error(`Job ${id} has zero steps. A job must have at least one step`);
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

    if (options.list) {
        if (options.task) {
            ctx.bus.send(new ListTaskMessage(options, tasks))
            return 0
        }

        if (options.job) {
            ctx.bus.send(new ListJobMessage(options, jobs))
            return 0
        }

        ctx.bus.send(new ListMessage(options, tasks, jobs))
        return 0;
    }

    ctx.env["OS"] = Deno.build.os;
    try {
        const r = osRelease();
        ctx.env["OS_ID"] = r.id;
        ctx.env["OS_VERSION"] = r.version;
        ctx.env["OS_VERSION_ID"] = r.versionId;
        ctx.env["OS_ID_LIKE"] = r.idLike;
        ctx.env["OS_NAME"] = r.name;
        ctx.env["OS_CODENAME"] = r.versionCodename;
        ctx.env["OS_VARIANT_ID"] = r.variantId;
        ctx.env["OS_VARIANT"] = r.variant;
    } catch (error) {
        ctx.bus.debug(error?.toString());
    }

    if (options.env) {
        for (const item of options.env) {
            const [key, value] = trim(item, '"').split("=");
            ctx.env[key] = env.expand(value, {
                getVariable: function(key) {
                    
                    let v = ctx.secrets[key];
                    if (v === undefined) {
                        v = ctx.env[key];
                    }

                    if (v === undefined)
                        v = env.get(key);

                    return v;
                }
            });
        }
    }

    


    if (options.envFile) {
        for (const item of options.envFile) {
            if (await fs.exists(item)) {
                const content = await fs.readTextFile(item);
                const envData = dotenv.parse(content);
                for (const key of Object.keys(envData)) {
                    const value = envData[key];
                    ctx.env[key] = env.expand(value, {
                        getVariable: function(key) {
                            
                            let v = ctx.secrets[key];
                            if (v === undefined) {
                                v = ctx.env[key];
                            }
        
                            if (v === undefined)
                                v = env.get(key);
        
                            return v;
                        }
                    });
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
                throw new Error(`Task not found: ${target}`);
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
