/**
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


export class CommandMessage extends Message {
    constructor(
        public readonly command: string,
        public readonly options: IRunnerOptions,
    ) {
        super("command");
    }
}
*/
