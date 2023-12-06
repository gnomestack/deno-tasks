import { PsOutput } from "../deps.ts";
import { IExecutionContext, IExecutionState, IRunnable } from "../execution/interfaces.ts";
import { TaskCollection } from "../tasks/task-collection.ts";

// deno-lint-ignore no-empty-interface
export interface IJobState extends IExecutionState {
}

export interface IJobContext extends IExecutionContext {
    /**
     * Gets the tasks for the current run. This object will hold task state for tasks
     * that have been previous executed in the same run.  The key is the task name
     * that has been converted to underscore case.  Spaces, colons, slashes, and
     * periods are replaced with underscores.
     */
    readonly jobs: Record<string, IJobState | undefined>;
    /**
     * Gets the task state for the current task that is executing.
     */
    readonly job: IJobState;
}

export type JobReturn = Promise<Record<string, unknown> | PsOutput | void> | Record<string, unknown> | PsOutput | void;
export type JobRun = (state: IJobContext, signal?: AbortSignal) => JobReturn;

export interface IJob extends IRunnable {
    tasks: TaskCollection;

    /**
     * Gets or sets a value indicating whether the task should be forced to run. If the
     * task is forced to run, it will be executed even if a previous task has failed.
     * This is useful for cleanup tasks.
     */
    force?: boolean | ((context: IJobContext) => Promise<boolean> | boolean);
    /**
     * Gets or sets a value indicating whether the task should be skipped. The task
     * context is passed to the skip function, so that tasks can be skipped based
     * on the state of previous tasks, environment variables, or other context information.
     */
    skip?: boolean | ((context: IJobContext) => Promise<boolean> | boolean);
}

export interface IPartialJobCore {
    /**
     * Gets the unique identifier for the task. This is used to reference the task
     * from other tasks or from the command line. It must not including any spaces
     * and may include only letters, numbers, dashes, colons, dots, and underscores.
     */
    id: string;
    /**
     * Gets or sets the name of the task. This is used to display a friendly name
     * task in the console and may use emojis and other characters not in the id.
     */
    name?: string;
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
    deps?: string[];
    /**
     * Gets or sets the timeout for the task. This is used to determine how long the task
     * will be allowed to run before it is cancelled.  If the task is cancelled, it will
     * be marked as a timeout and treated as a failure.
     */
    timeout?: number;
    /**
     * Gets or sets a value indicating whether the task should be forced to run. If the
     * task is forced to run, it will be executed even if a previous task has failed.
     * This is useful for cleanup tasks.
     */
    force?: boolean;
    /**
     * Gets or sets a value indicating whether the task should be skipped. The task
     * context is passed to the skip function, so that tasks can be skipped based
     * on the state of previous tasks, environment variables, or other context information.
     */
    skip?: boolean | ((state: IJobContext) => Promise<boolean> | boolean);
}

export interface IPartialJob extends IPartialJobCore {
    run: JobRun;
}

export interface IJobBuilder {
    /**
     * Sets multiple attributes on the task.
     * @param attributes
     */
    set(attributes: Partial<Omit<IJob, "id" | "run">>): IJobBuilder;
    /**
     * Sets the description of the task.
     * @param description
     */
    description(description: string): IJobBuilder;
    /**
     * Sets the timeout for the task.
     * @param timeout
     */
    timeout(timeout: number): IJobBuilder;
    /**
     * Sets the name of the task.
     * @param name
     */
    name(name: string): IJobBuilder;
    /**
     * Sets whether the task should be skipped.
     * @param skip
     */
    skip(skip: boolean | ((context: IJobContext) => Promise<boolean> | boolean)): IJobBuilder;
    /**
     * Sets the dependencies for the task.
     * @param deps
     */
    deps(...deps: string[]): IJobBuilder;
}

export interface IJobCollection extends Iterable<IJob> {
    size: number;
    add(job: IJob): IJobBuilder;
    addRange(jobs: Iterable<IJob>): void;
    at(index: number): IJob;
    get(id: string): IJob | undefined;
    has(id: string): boolean;
    toArray(): IJob[];
}
