import { ExecutionStatus, IExecutionContext } from "../execution/types.ts";

export interface IFireTaskExecutionContext extends IExecutionContext {
    task: IFireTask;
    defaults: Record<string, unknown>;
}

export interface IFireTask {
    id: string;
    name?: string;
    env: Record<string, string>;
    needs?: string[];
    description?: string;
    timeout?:
        | number
        | ((ctx: IFireTaskExecutionContext) => number)
        | ((ctx: IFireTaskExecutionContext) => Promise<number>);
    if?:
        | boolean
        | ((ctx: IFireTaskExecutionContext) => boolean)
        | ((ctx: IFireTaskExecutionContext) => Promise<boolean>);
    continueOnError?:
        | boolean
        | ((ctx: IFireTaskExecutionContext) => boolean)
        | ((ctx: IFireTaskExecutionContext) => Promise<boolean>);
}

export interface ITaskResult {
    status: ExecutionStatus;
    outputs: Record<string, unknown>;
    error?: Error;
    task: IFireTask;
    startAt: Date;
    endAt: Date;
}

export class TaskResult implements ITaskResult {
    status: ExecutionStatus = "none";
    outputs: Record<string, unknown> = {};
    error?: Error;
    task: IFireTask;
    startAt: Date = new Date();
    endAt: Date = new Date();

    constructor(task: IFireTask) {
        this.task = task;
    }
}

export type FireTaskHandler = (
    ctx: IFireTaskExecutionContext,
) => Promise<ITaskResult>;
