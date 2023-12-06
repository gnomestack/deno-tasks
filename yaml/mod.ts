import { YAML } from "../deps.ts";

export interface IVaultSection extends Record<string, unknown> {
    kind: string;
}

export interface ISecretSection extends Record<string, unknown> {
    create?: boolean;
    path: string;
    length?: number;
    upper?: boolean;
    lower?: boolean;
    digits?: boolean;
    symbols?: boolean;
}

export interface IHostSection extends Record<string, unknown> {
    host: string;
    user: string;
    password?: string;
    identity?: string;
    options?: Record<string, string>;
}

export type Target = string | IHostSection;

export interface IDefaultsSection extends Record<string, unknown> {
    hosts?: Target[];
}

export interface ITaskSection extends Record<string, unknown> {
    name: string;
    id: string;
    run?: string;
    shell?: string;
    uses?: string;
    runAs?: {
        user: string;
        password?: string;
        identity?: string;
    },
    hosts?: Target[];
    remote?: string;
    deps?: string[];
    with?: Record<string, string>;
    timeout?: number;
    continueOnError?: boolean;
    if?: string;
}

export type TaskSectionOrString = ITaskSection | string;

export interface IJobSection extends Record<string, unknown> {
    name: string;
    id: string;
    run?: string;
    shell?: string;
    uses?: string;
    tasks?: TaskSectionOrString[];
    runAs?: {
        user: string;
        password?: string;
        identity?: string;
    },
    hosts?: Target[];
    remote?: string;
    deps?: string[];
    with?: Record<string, string>;
    timeout?: number;
    continueOnError?: boolean;
    if?: string;
}


export interface IWorkflow extends Record<string, unknown> {
    vault?: IVaultSection;
    secrets?: Record<string, ISecretSection | undefined>;
    defaults?: IDefaultsSection;
    env?: Record<string, string | undefined>;
    tasks?: ITaskSection[];
}

export function parseWorkflow(data: string): IWorkflow {
    const yaml = YAML.parse(data) as Record<string, unknown>;
    const workflow: IWorkflow = {};

    if (typeof yaml !== "object") {
        throw new Error("yaml must be an object");
    }



    if (yaml["vault"]) {
        const vault = yaml["vault"] as IVaultSection;
        workflow.vault = vault;
    }

    if (yaml["secrets"]) {
        const secrets = yaml["secrets"] as Record<string, unknown>;
        if (typeof secrets !== "object") {
            throw new Error("secrets must be an object");
        }

        const secretsMap: Record<string, ISecretSection | undefined> = {};
        for(const key in secrets) {
            const n = secrets[key] as Record<string, unknown>;
            if (typeof n === "string") {
                secretsMap[key] = {
                    path: n,
                };
                continue;
            }

            if (typeof n !== "object") {
                throw new Error("secret must be an object");
            }

            const secret: ISecretSection = {
                create: false,
                path: "",
            };

            if (typeof n["create"] === "boolean") {
                secret.create = n["create"];
            }

            if (typeof n["path"] === "string") {
                secret.path = n["path"];
            }

            if (typeof n["length"] === "number") {
                secret.length = n["length"];
            }

            if (typeof n["upper"] === "boolean") {
                secret.upper = n["upper"];
            }

            if (typeof n["lower"] === "boolean") {
                secret.lower = n["lower"];
            }

            if (typeof n["digits"] === "boolean") {
                secret.digits = n["digits"];
            }

            if (typeof n["symbols"] === "boolean") {
                secret.symbols = n["symbols"];
            }

            if (secret.path.length === 0) {
                throw new Error(`secret ${key} must specify a path`);
            }

            secretsMap[key] = secret;
        }
    }

    if (yaml["env"]) {
        const env = yaml["env"] as Record<string, string>;
        if (typeof env !== "object") {
            throw new Error("secrets must be an object");
        }
        
        workflow.env = env;
    }

    if (yaml["defaults"]) {
        const defaults = yaml["defaults"] as Record<string, unknown>;
        if (typeof defaults !== "object") {
            throw new Error("defaults must be an object");
        }

        const defaultsSection: IDefaultsSection = {
            hosts: [],
        };

        if (Array.isArray(defaults["hosts"])) {
            defaultsSection.hosts = defaults["hosts"].map((o) => {
                if (typeof o === "string") {
                    return o;
                }

                if (typeof o === "object") {
                    return o as IHostSection;
                }

                throw new Error("default host must be a string or an object");
            });
        }

        workflow.defaults = defaultsSection;
    }

    if (yaml["tasks"]) {
        const yamlTasks = yaml["tasks"] as Record<string, unknown>;
        
        const tasks: ITaskSection[] = [];
        for(const key in yamlTasks) {
            const n = yamlTasks[key] as Record<string, unknown>;
            const task : ITaskSection = {
                name: "",
                id: "",
            };
            if (typeof n !== "object") {
                throw new Error("task must be an object");
            }

            task.id = key;
        
            if (typeof n["name"] === "string") {
                task.name = n["name"];
            }

            if (typeof n["run"] === "string") {
                task.run = n["run"];
            }

            if (typeof n["shell"] === "string") {
                task.shell = n["shell"];
            }

            if (typeof n["uses"] === "string") {
                task.uses = n["uses"];
            }

            if (typeof n["runAs"] === "object") {
                const runAs = n["runAs"] as Record<string, unknown>;
                if (typeof runAs["user"] === "string") {
                    task.runAs = {
                        user: runAs["user"],
                    };

                    if (typeof runAs["password"] === "string") {
                        task.runAs.password = runAs["password"];
                    }

                    if (typeof runAs["identity"] === "string") {
                        task.runAs.identity = runAs["identity"];
                    }
                }
            }

            if (typeof n["remote"] === "string") {
                task.remote = n["remote"];
            }

            if (Array.isArray(n["deps"])) {
                task.deps = n["deps"].map((o) => o.toString());
            }

            if (typeof n["with"] === "object") {
                task.with = n["with"] as Record<string, string>;
            }

            if (typeof n["timeout"] === "number") {
                task.timeout = n["timeout"];
            }

            if (typeof n["continueOnError"] === "boolean") {
                task.continueOnError = n["continueOnError"];
            }

            if (typeof n["if"] === "string") {
                task.if = n["if"];
            }

            tasks.push(task);
        }

        workflow.tasks = tasks;

        if (yaml["jobs"]) {
            if (! (typeof yaml["jobs"] === "object")) {
                throw new Error("jobs must be an object");
            }

            const yamlJobs = yaml["jobs"] as Record<string, unknown>;
            for(const key in yamlJobs) {
                const n = yamlJobs[key] as Record<string, unknown>;
                const task : ITaskSection = {
                    name: "",
                    id: "",
                };
            }

        }

       
    }



    return workflow;
}