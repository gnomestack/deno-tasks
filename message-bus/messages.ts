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
