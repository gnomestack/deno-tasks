import { JobCollection } from "../jobs/job-collection.ts";
import { Message } from "../message-bus/mod.ts";
import { TaskCollection } from "../tasks/task-collection.ts";
import { IRunnerOptions } from "./types.ts";

export class CommandMessage extends Message {
    constructor(
        public readonly command: string,
        public readonly options: IRunnerOptions,
    ) {
        super("command");
    }
}

export class ListTaskMessage extends CommandMessage {
    constructor(options: IRunnerOptions, public tasks: TaskCollection) {
        super("list-tasks", options);
    }
}

export class ListJobMessage extends CommandMessage {
    constructor(options: IRunnerOptions, public jobs: JobCollection) {
        super("list-jobs", options);
    }
}

export class ListMessage extends CommandMessage {
    constructor(options: IRunnerOptions, public tasks: TaskCollection, public jobs: JobCollection) {
        super("list", options);
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
