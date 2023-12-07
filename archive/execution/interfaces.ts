export type ExecutionStatus =
    | "ok"
    | "failed"
    | "timeout"
    | "running"
    | "skipped"
    | "cancelled";

export interface IExecutionState {
    /**
     * Gets the unique identifier for the task. This is used to reference the task
     * from other tasks or from the command line. It must not including any spaces
     * and may include only letters, numbers, dashes, colons, dots, and underscores.
     */
    id: string;
    /**
     * Gets or sets the name of the task. This is used to display the task in the console.
     */
    name: string;
    /**
     * Gets or sets the description of the task. This is used to display the description
     * of the task in the console.
     */
    description?: string;
    /**
     * Gets the dependencies for the task. This is used to determine the order
     * in which tasks are executed.  If a task has no dependencies, it will be
     * executed first.  If a task has dependencies, it will be executed after
     * all of its dependencies have been executed.
     */
    deps: string[];
    /**
     * Gets or sets the timeout for the task. This is used to determine how long the task
     * will be allowed to run before it is cancelled.  If the task is cancelled, it will
     * be marked as a timeout and treated as a failure.
     */
    timeout?: number;
    /**
     * Gets a value indicating whether the task was forced to run.
     */
    force?: boolean;
    /**
     * Gets a value indicating whether the task was skipped.
     */
    skip?: boolean;
    /**
     * Gets the status of the task.
     */
    status: ExecutionStatus;
    /**
     * Gets the outputs of the task.
     */
    outputs: Record<string, unknown>;
}

export interface IExecutionContext {
    /**
     * Gets the environment variables for the current task. This is primarily used
     * to get environment variables and may be use to set environment variables
     * for dependent tasks within the same run.
     */
    readonly env: Record<string, string | undefined>;
    /**
     * Gets the secrets for the current task. This is primarily used to get secrets.
     * The internal implementation is subject to change before 1.0.
     */
    readonly secrets: Record<string, string | undefined>;
}

export interface IRunnable {
    /**
     * Gets the unique identifier for the task. This is used to reference the task
     * from other tasks or from the command line. It must not including any spaces
     * and may include only letters, numbers, dashes, colons, dots, and underscores.
     */
    id: string;
    /**
     * Gets or sets the name of the task. This is used to display the task in the console.
     */
    name: string;
    /**
     * Gets or sets the description of the task. This is used to display the description
     * of the task in the console.
     */
    description?: string;
    /**
     * Gets the dependencies for the task. This is used to determine the order
     * in which tasks are executed.  If a task has no dependencies, it will be
     * executed first.  If a task has dependencies, it will be executed after
     * all of its dependencies have been executed.
     */
    deps: string[];
    /**
     * Gets or sets the timeout for the task. This is used to determine how long the task
     * will be allowed to run before it is cancelled.  If the task is cancelled, it will
     * be marked as a timeout and treated as a failure.
     */
    timeout?: number;
}
