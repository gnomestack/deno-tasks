import { ITask } from "../tasks/interfaces.ts";
import { IRunnerOptions, ITaskResult } from "./interfaces.ts";
import { Message } from "./message-bus.ts";

export class GroupStartMessage extends Message {
    constructor(groupName: string) {
        super("group-start");
        this.groupName = groupName;
    }

    groupName: string;
}

export class GroupEndMessage extends Message {
    constructor(groupName: string) {
        super("group-end");
        this.groupName = groupName;
    }

    groupName: string;
}

export class CommandMessage extends Message {
    constructor(
        public readonly command: string,
        public readonly options: IRunnerOptions,
    ) {
        super("command");
    }
}

export class ListTaskMessage extends CommandMessage {
    constructor(options: IRunnerOptions) {
        super("list-tasks", options);
    }
}

export class VersionMessage extends CommandMessage {
    constructor(options: IRunnerOptions) {
        super("version", options);
    }
}

export class HelpMessage extends CommandMessage {
    constructor(options: IRunnerOptions) {
        super("help", options);
    }
}

export class TaskStartMessage extends Message {
    constructor(public readonly task: ITask) {
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

export class TaskResultsMessage extends Message {
    constructor(public readonly taskResults: ITaskResult[]) {
        super("tasks-summary");
    }
}

export class UnhandledErrorMessage extends Message {
    constructor(error: Error | string) {
        super("unhandled-error");
        if (typeof error === "string") {
            this.error = new Error(error);
        } else {
            this.error = error;
        }
    }

    error: Error;
}

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
