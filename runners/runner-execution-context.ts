import { IExecutionContext } from "../execution/types.ts";
import { IMessageBus, MessageBus } from "../message-bus/mod.ts";
import { getFireDefaults } from "./globals.ts";

export class RunnerExecutionContext implements IExecutionContext {
    defaults: Record<string, unknown>;
    bus: IMessageBus;
    outputs: Record<string, unknown>;
    signal: AbortSignal;
    env: Record<string, string | undefined>;
    secrets: Record<string, string | undefined>;
    abortController: AbortController;

    constructor() {
        this.defaults = getFireDefaults();
        this.bus = new MessageBus();
        this.outputs = {};
        this.env = {};
        this.secrets = {};
        this.abortController = new AbortController();
        this.signal = this.abortController.signal;
    }
}
