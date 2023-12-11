import { IAnsiWriter } from "../deps.ts";

export interface IRunnerOptions {
    cmds?: string[];
    skipNeeds?: boolean;
    timeout?: number;
    help?: boolean;
    job?: boolean;
    task?: boolean;
    fireFile?: string;
    envFile?: string[];
    env?: string[];
    list?: boolean;
    tasksLoaded?: boolean;
    ansiWriter?: IAnsiWriter;
    workingDirectory?: string;
    version?: boolean;
}