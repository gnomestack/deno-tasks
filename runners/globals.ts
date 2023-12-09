import { ansiWriter, IAnsiWriter } from "../deps.ts";
import { TaskCollection, tasks } from "../tasks/task-collection.ts";
import { JobCollection, jobs } from "../jobs/job-collection.ts";
export { tasks } from "../tasks/task-collection.ts";

const g = globalThis as unknown as {
    ansiWriter?: IAnsiWriter;
    fireTasks: TaskCollection;
    fireJobs: JobCollection;
    fireDefaults: Record<string, unknown>;
    fireSecrets: Record<string, unknown>;
    fireDebug?: boolean;
    fireTrace?: boolean;
};

export function getFireDefaults() {
    g.fireDefaults ??= {};
    return g.fireDefaults;
}

export function setFireDefaults(defaults: Record<string, unknown>) {
    g.fireDefaults = defaults;
}

export function getFireTasks() {
    g.fireTasks ??= tasks;
    return g.fireTasks;
}

export function setFireTasks(tasks: TaskCollection) {
    g.fireTasks = tasks;
}

export function getFireJobs() {
    g.fireJobs ??= jobs;
    return g.fireJobs;
}

export function setFireJobs(jobs: JobCollection) {
    g.fireJobs = jobs;
}

export function getDebug() {
    return g.fireDebug ?? false;
}

export function setDebug(debug: boolean) {
    g.fireDebug = debug;
}

export function getTrace() {
    return g.fireTrace ?? false;
}

export function setTrace(trace: boolean) {
    g.fireTrace = trace;
}

export function getHostWriter(): IAnsiWriter {
    g.ansiWriter ??= ansiWriter;
    return g.ansiWriter!;
}

export function setHostWriter(writer: IAnsiWriter) {
    g.ansiWriter = writer;
}
