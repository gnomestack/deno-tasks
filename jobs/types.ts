import { ExecutionStatus, IExecutionContext } from "../execution/types.ts";
import { TaskCollection } from "../tasks/task-collection.ts";
import { ITaskResult } from "../tasks/types.ts";

export interface IFireJobExecutionContext extends IExecutionContext {
    job: IFireJob;
    defaults: Record<string, unknown>;
}

export interface IFireJob {
    id: string;
    name?: string;
    env: Record<string, string>;
    tasks: TaskCollection;
    needs?: string[];
    description?: string;
    defaults?: Record<string, unknown>;
    timeout?:
        | number
        | ((ctx: IFireJobExecutionContext) => number)
        | ((ctx: IFireJobExecutionContext) => Promise<number>);
    if?:
        | boolean
        | ((ctx: IFireJobExecutionContext) => boolean)
        | ((ctx: IFireJobExecutionContext) => Promise<boolean>);
    continueOnError?:
        | boolean
        | ((ctx: IFireJobExecutionContext) => boolean)
        | ((ctx: IFireJobExecutionContext) => Promise<boolean>);
}

export interface IJobResult {
    status: ExecutionStatus;
    outputs: Record<string, unknown>;
    error?: Error;
    job: IFireJob;
    taskResults: ITaskResult[];
    startAt: Date;
    endAt: Date;
}

export class JobResult implements IJobResult {
    status: ExecutionStatus;
    outputs: Record<string, unknown> = {};
    error?: Error;
    job: IFireJob;
    taskResults: ITaskResult[];
    startAt: Date = new Date();
    endAt: Date = new Date();

    constructor(job: IFireJob) {
        this.status = "running";
        this.job = job;
        this.taskResults = [];
    }
}
