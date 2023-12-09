import { IAnsiWriter, parseArgs } from "../deps.ts";
import { IRunnerOptions } from "./types.ts";

export function handleArgs(args: string[], hostWriter: IAnsiWriter) {
    const cmds: string[] = [];
    const flags = parseArgs(args, {
        boolean: ["skip-deps", "list", "help", "version", "jobs", "tags"],
        string: ["fire-file", "env-file", "env"],
        collect: ["env-file", "env"],
        alias: {
            h: "help",
            s: "skip-deps",
            t: "timeout",
            e: "env",
            ef: "env-file",
            f: "fire-file",
            l: "list",
            wd: "working-directory",
            v: "version",
        },
        default: {
            "working-directory": Deno.cwd(),
            list: false,
            "skip-deps": false,
            timeout: 0,
            help: false,
            "task-file": undefined,
            "env-file": [],
            env: [],
            version: false,
        },
    });

    const unparsed = flags["_"];
    if (Array.isArray(unparsed)) {
        cmds.push(...unparsed.map((u) => u.toString()));
    }

    let wd = flags["working-directory"] as string || undefined;
    if (typeof wd !== "string") {
        wd = undefined;
    } else {
        if (wd.startsWith("http")) {
            const url = new URL(wd);
            wd = url.pathname;
        }
    }

    const envFile: string[] = flags["env-file"] ?? [];
    const env: string[] = flags["env"] ?? [];
    let fireFile: string | undefined = undefined;

    if (flags["fire-file"]) {
        const taskFileArg = flags["fire-file"] as string;
        if (taskFileArg.length) {
            fireFile = taskFileArg;
        }
    }

    const timeoutValue = flags.timeout || flags.t;

    let to = 3 * 60 * 60;
    if (typeof timeoutValue === "string") {
        to = Number(timeoutValue);
    } else if (typeof timeoutValue !== "number") {
        to = flags.timeout as number;
    }

    if (isNaN(to)) {
        to = 3 * 60 * 60;
    }

    const help = (flags["help"] || flags["h"]) === true;
    const skipDeps = (flags["skip-deps"] || flags["s"]) === true;
    const list = (flags["list"] || flags["l"]) === true;
    const version = (flags["version"] || flags["v"]) === true;

    const options: IRunnerOptions = {
        cmds,
        skipNeeds: skipDeps,
        timeout: to,
        help: help,
        fireFile: fireFile,
        ansiWriter: hostWriter,
        envFile: envFile,
        env: env,
        workingDirectory: wd,
        list: list,
        version: version,
    };

    if (cmds.length === 0) {
        cmds.push("default");
    }

    return options;
}
