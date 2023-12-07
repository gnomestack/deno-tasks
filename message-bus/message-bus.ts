export class Message {
    kind: string;

    constructor(kind: string) {
        this.kind = kind;
    }
}

export class LogMessage extends Message {
    constructor(level: string, public readonly message: string) {
        super(level);
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
