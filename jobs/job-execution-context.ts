import { ExecutionContext } from "../execution/execution-context.ts";
import { IMessageBus } from "../message-bus/mod.ts";
import { IFireJob, IFireJobExecutionContext } from "./types.ts";

export class JobExecutionContext extends ExecutionContext implements IFireJobExecutionContext {
    readonly job: IFireJob;

    defaults: Record<string, unknown> = {};

    constructor(
        job: IFireJob,
        defaults?: Record<string, unknown>,
        bus?: IMessageBus,
        outputs?: Record<string, unknown>,
        signal?: AbortSignal,
        env?: Record<string, string | undefined>,
        secrets?: Record<string, string | undefined>,
    ) {
        super(defaults, bus, outputs, signal, env, secrets);
        this.job = job;
    }
}
