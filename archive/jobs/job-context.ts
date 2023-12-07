import { IJobContext, IJobState } from "./interfaces.ts";

export class JobContext extends Map<string, unknown> implements IJobContext {
    constructor(
        iterable?: Iterable<readonly [string, unknown]> | null | undefined,
    ) {
        super(iterable);
    }

    get secrets(): Record<string, string | undefined> {
        let _secrets = this.get("secrets");
        if (!_secrets) {
            _secrets = {};
            this.set("secrets", _secrets);
        }

        return _secrets as Record<string, string | undefined>;
    }

    get env(): Record<string, string | undefined> {
        let _env = this.get("env");
        if (!_env) {
            _env = {};
            this.set("env", _env);
        }

        return _env as Record<string, string | undefined>;
    }

    get jobs(): Record<string, IJobState | undefined> {
        let _tasks = this.get("tasks");
        if (!_tasks) {
            _tasks = {};
            this.set("tasks", _tasks);
        }

        return _tasks as Record<string, IJobState | undefined>;
    }

    get job(): IJobState {
        let _task = this.get("task");
        if (!_task) {
            _task = {};
            this.set("task", _task);
        }

        return _task as IJobState;
    }
}
