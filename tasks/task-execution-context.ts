import { ExecutionContext } from "../execution/execution-context.ts";
import { IMessageBus } from "../message-bus/message-bus.ts";
import { IFireTask, IFireTaskExecutionContext } from "./types.ts";

export class TaskExecutionContext extends ExecutionContext implements IFireTaskExecutionContext {
    readonly task: IFireTask;

    defaults: Record<string, unknown> = {};

    constructor(
        task: IFireTask,
        defaults?: Record<string, unknown>,
        bus?: IMessageBus,
        outputs?: Record<string, unknown>,
        signal?: AbortSignal,
        env?: Record<string, string | undefined>,
        secrets?: Record<string, string | undefined>,
    ) {
        super(defaults, bus, outputs, signal, env, secrets);
        this.task = task;
    }
}
