import { Message } from "../message-bus/mod.ts";
import { IFireTask, ITaskResult } from "./types.ts";

export class TaskTimeoutMessage extends Message {
    constructor(
        public readonly taskResult: ITaskResult,
        public readonly timeout: number,
    ) {
        super("task-timeout");
    }
}

export class TaskSkippedMessage extends Message {
    constructor(public readonly taskResult: ITaskResult) {
        super("task-skipped");
    }
}

export class TaskEndMessage extends Message {
    constructor(public readonly taskResult: ITaskResult) {
        super("task-end");
    }
}

export class TaskStartMessage extends Message {
    constructor(public readonly task: IFireTask) {
        super("task-start");
    }
}

export class TaskCancellationMessage extends Message {
    constructor(
        public readonly taskResult: ITaskResult,
        public readonly signal: AbortSignal,
    ) {
        super("task-cancelled");
    }
}

export class TaskSummaryMessage extends Message {
    constructor(public readonly taskResults: ITaskResult[]) {
        super("tasks-summary");
    }
}
