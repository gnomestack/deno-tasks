import { IMessageBus, MessageBus } from "../message-bus/mod.ts";

export class ExecutionContext {
    bus: IMessageBus;

    outputs: Record<string, unknown>;

    signal: AbortSignal;

    env: Record<string, string | undefined>;

    secrets: Record<string, string | undefined>;

    defaults: Record<string, unknown>;

    constructor(
        defaults?: Record<string, unknown>,
        bus?: IMessageBus,
        outputs?: Record<string, unknown>,
        signal?: AbortSignal,
        env?: Record<string, string | undefined>,
        secrets?: Record<string, string | undefined>,
    ) {
        this.defaults = defaults ?? {};
        this.bus = bus ?? new MessageBus();
        this.outputs = outputs ?? {};
        this.signal = signal ?? new AbortController().signal;
        this.env = env ?? {};
        this.secrets = secrets ?? {};
    }
}
