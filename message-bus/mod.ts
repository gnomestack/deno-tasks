export class Message {
    kind: string;

    constructor(kind: string) {
        this.kind = kind;
    }
}

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

export class LogMessage extends Message {
    constructor(level: string, public readonly message: string) {
        super(level);
    }
}

export class TraceMessage extends LogMessage {
    constructor(message: string) {
        super("trace", message);
    }
}

export class DebugMessage extends LogMessage {
    constructor(message: string) {
        super("debug", message);
    }
}

export class InfoMessage extends LogMessage {
    constructor(message: string) {
        super("info", message);
    }
}

export class WarnMessage extends LogMessage {
    constructor(message: string) {
        super("warn", message);
    }
}

export class ErrorMessage extends LogMessage {
    constructor(message: string, public readonly error: unknown) {
        super("error", message);
    }
}

export interface IMessageSink {
    (message: Message): void;
}

export interface IMessageBus {
    addListener(listener: IMessageSink): void;
    removeListener(listener: IMessageSink): void;
    send(message: Message): void;
    error(error: Error, message?: string): void;
    warn(message: string): void;
    info(message: string): void;
    debug(message: string): void;
    trace(message: string): void;
}

export class MessageBus implements IMessageBus {
    #listeners: IMessageSink[];

    constructor() {
        this.#listeners = [];
    }

    addListener(listener: IMessageSink) {
        this.#listeners.push(listener);
    }

    removeListener(listener: IMessageSink) {
        this.#listeners = this.#listeners.filter((l) => l !== listener);
    }

    send(message: Message) {
        this.#listeners.forEach((l) => l(message));
    }

    trace(message: string) {
        this.send(new TraceMessage(message));
    }

    debug(message: string) {
        this.send(new DebugMessage(message));
    }

    info(message: string) {
        this.send(new InfoMessage(message));
    }

    warn(message: string) {
        this.send(new WarnMessage(message));
    }

    error(error: Error, message?: string) {
        this.send(new ErrorMessage(message ?? error.message, error));
    }
}
