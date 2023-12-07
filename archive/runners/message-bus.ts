export class Message {
    kind: string;

    constructor(kind: string) {
        this.kind = kind;
    }
}

export interface IMessageSink {
    (message: Message): void;
}

export class MessageBus {
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
}
