import { ITaskContext, ITaskState } from "./interfaces.ts";

export class TaskContext extends Map<string, unknown> implements ITaskContext {
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

    get tasks(): Record<string, ITaskState | undefined> {
        let _tasks = this.get("tasks");
        if (!_tasks) {
            _tasks = {};
            this.set("tasks", _tasks);
        }

        return _tasks as Record<string, ITaskState | undefined>;
    }

    get task(): ITaskState {
        let _task = this.get("task");
        if (!_task) {
            _task = {};
            this.set("task", _task);
        }

        return _task as ITaskState;
    }
}
