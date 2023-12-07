import { dotenv, env, fs, homeConfigDir, path, ProtectedValue, ps, SecretGenerator } from "../deps.ts";
import { parseWorkflow } from "../yaml/mod.ts";
import { createCredentials, getOrCreateKey, KpDatabase } from "../secrets/mod.ts";
import { handlebars, registerDefault } from "../hbs/mod.ts";
import { shellTask } from "../mod.ts";
import { remoteTask } from "../tasks/remote-task.ts";
import { dockerTask } from "../tasks/docker-task.ts";

const hbs = handlebars.create();

registerDefault(hbs);

export async function runYaml(file: string) {
    const data = Deno.readTextFileSync(file);
    const workflow = parseWorkflow(data);

    const secrets: Record<string, string | undefined> = {};

    if (workflow.vault) {
        const vault = workflow.vault;
        const lower = "abcdefghijklmnopqrstuvwxyz";
        const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const digits = "0123456789";
        const symbols = "!@#$%^&*()_+-=[]{};:,./<>?`~";
        switch (vault.kind) {
            case "dotenv":
                {
                    if (!(typeof (vault.path) === "string")) {
                        throw new Error("dotenv vaults must specify a path");
                    }

                    let content = Deno.readTextFileSync(vault.path);
                    let isSops = false;
                    if (content.includes("sops_version=")) {
                        isSops = true;
                        const r = await ps.exec("sops", ["-d", vault.path], {
                            stdout: "piped",
                        });
                        content = r.throwOrContinue().stdoutText;
                    }

                    const envData = dotenv.parse(content);

                    if (workflow.secrets) {
                        let updated = false;
                        for (const [key, entry] of Object.entries(workflow.secrets)) {
                            if (entry?.path) {
                                secrets[key] = envData[entry.path];
                            }

                            if (!entry?.create) {
                                throw new Error(`Secret entry ${key} must specify a path`);
                            }

                            const sg = new SecretGenerator();
                            if (entry?.lower === true || entry?.lower === undefined) {
                                sg.add(lower);
                            }

                            if (entry?.upper === true || entry?.upper === undefined) {
                                sg.add(upper);
                            }

                            if (entry?.digits === true || entry?.digits === undefined) {
                                sg.add(digits);
                            }

                            if (typeof (entry?.symbols) === "string") {
                                sg.add(entry?.symbols);
                            } else if (
                                entry?.symbols === true || entry?.symbols === undefined
                            ) {
                                sg.add(symbols);
                            }

                            const length = entry?.length || 16;

                            secrets[key] = sg.generate(length);
                            content += `\n${key}=${secrets[key]}`;
                            updated = true;
                        }

                        if (updated) {
                            if (isSops) {
                                await fs.writeTextFile(vault.path, content);
                                const r = await ps.exec("sops", ["-e", "-i", vault.path]);
                                r.throwOrContinue();
                            } else {
                                fs.writeTextFile(vault.path, content);
                            }
                        }
                    }
                }

                break;

            case "kdbx":
                {
                    let dbFile = vault.path as string;
                    if (typeof dbFile !== "string") {
                        dbFile = path.join(
                            homeConfigDir(),
                            "gnomestack",
                            "vaults",
                            "default.kdbx",
                        );
                    }

                    if (!path.isAbsolute(dbFile)) {
                        vault.path = path.resolve(ps.cwd, dbFile);
                    }

                    if (!await fs.exists(dbFile)) {
                        throw new Error(`Vault file not found: ${dbFile}`);
                    }

                    const { key } = await getOrCreateKey();
                    const credentials = createCredentials(key);
                    const db = await KpDatabase.open(dbFile, credentials);

                    if (workflow.secrets) {
                        let updated = false;
                        for (const [key, entry] of Object.entries(workflow.secrets)) {
                            if (entry === undefined) {
                                continue;
                            }

                            if (entry?.path) {
                                const kpEntry = db.findEntry(entry.path);
                                if (kpEntry) {
                                    const field = kpEntry.fields.get("Password");
                                    const value = field instanceof ProtectedValue ? field.getText() : field;
                                    secrets[key] = value;
                                    continue;
                                }
                            }

                            if (!entry?.create) {
                                throw new Error(`Secret entry ${key} must specify a path`);
                            }

                            const sg = new SecretGenerator();
                            if (entry?.lower === true || entry?.lower === undefined) {
                                sg.add(lower);
                            }

                            if (entry?.upper === true || entry?.upper === undefined) {
                                sg.add(upper);
                            }

                            if (entry?.digits === true || entry?.digits === undefined) {
                                sg.add(digits);
                            }

                            if (typeof (entry?.symbols) === "string") {
                                sg.add(entry?.symbols);
                            } else if (
                                entry?.symbols === true || entry?.symbols === undefined
                            ) {
                                sg.add(symbols);
                            }

                            const length = entry?.length || 16;

                            const v = secrets[key] = sg.generate(length);
                            db.setSecret(entry.path, v);
                            updated = true;
                        }

                        if (updated) {
                            await db.save();
                        }
                    }
                }
                break;

            default:
                throw new Error(`Unknown vault kind: ${workflow.vault.kind}`);
        }
    }

    const envValues: Record<string, string | undefined> = {};

    const model = { secrets: secrets, env: env.toObject() };

    if (workflow.env) {
        for (const [key, value] of Object.entries(workflow.env)) {
            if (!value) {
                continue;
            }

            if (value.includes("{{") && value.includes("}}")) {
                const template = hbs.compile(value);
                const result = template(model);
                envValues[key] = result;
                continue;
            }

            envValues[key] = value;
        }
    }

    if (workflow.tasks) {
        for (const taskSection of workflow.tasks) {
            if (taskSection.remote) {
                if (!taskSection.run) {
                    throw new Error("remote task must specify a script");
                }

                remoteTask({
                    id: taskSection.id,
                    name: taskSection.name,
                    script: taskSection.run,
                    shell: taskSection.shell,
                    deps: taskSection.deps,
                    timeout: taskSection.timeout,
                    force: taskSection.continueOnError,
                    skip: (state) => {
                        const template = hbs.compile(taskSection.run);
                        const result = template(state);
                        if (result === "true" || result === "1") {
                            return true;
                        }

                        return false;
                    },
                    hosts: taskSection.hosts,
                    remote: taskSection.remote,
                    with: taskSection.with,
                    runAs: taskSection.runAs,
                });
            }

            if (taskSection.uses) {
                if (taskSection.uses.startsWith("docker://")) {
                    const image = taskSection.uses.substring(9);
                    dockerTask({
                        id: taskSection.id,
                        name: taskSection.name,
                        image: image,
                        with: {
                            ...taskSection.with,
                        },
                        deps: taskSection.deps,
                        timeout: taskSection.timeout,
                        force: taskSection.continueOnError,
                        skip: (state) => {
                            const template = hbs.compile(taskSection.run);
                            const result = template(state);
                            if (result === "true" || result === "1") {
                                return true;
                            }

                            return false;
                        },
                    });

                    continue;
                }

                throw new Error(`Unknown task uses: ${taskSection.uses}`);
            }

            if (taskSection.run) {
                if (taskSection.run.includes("{{") && taskSection.run.includes("}}")) {
                    const template = hbs.compile(taskSection.run);
                    const result = template(model);
                    taskSection.run = result;
                }

                shellTask({
                    id: taskSection.id,
                    name: taskSection.name,
                    script: taskSection.run,
                    shell: taskSection.shell,
                    deps: taskSection.deps,
                    timeout: taskSection.timeout,
                    force: taskSection.continueOnError,
                    skip: (state) => {
                        const template = hbs.compile(taskSection.run);
                        const result = template(state);
                        if (result === "true" || result === "1") {
                            return true;
                        }

                        return false;
                    },
                });

                continue;
            }

            throw new Error(`Unsupported task type for ${taskSection.id}`);
        }
    }
}
