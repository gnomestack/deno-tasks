import { IMessageBus } from "../message-bus/mod.ts";

export type ExecutionStatus =
    | "none"
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "skipped";

export type ResourceState = "present" | "absent";

export interface IOutputs extends Record<string, unknown> {
    status: ExecutionStatus;
}

export interface IExecutionContext {
    defaults: Record<string, unknown>;
    bus: IMessageBus;
    outputs: Record<string, unknown>;
    signal: AbortSignal;
    env: Record<string, string | undefined>;
    secrets: Record<string, string | undefined>;
}
