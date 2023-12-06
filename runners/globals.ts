import { AnsiWriter, IAnsiWriter } from "../deps.ts";
import { ITaskCollection } from "../tasks/interfaces.ts";
export { getTasks, setTasks } from "../tasks/task-collection.ts";

const g = globalThis as {
    hostWriter?: IAnsiWriter;
    tasks?: ITaskCollection;
    debug?: boolean;
    verbose?: boolean;
};

export function getDebug() {
    return g.debug ?? false;
}

export function setDebug(debug: boolean) {
    g.debug = debug;
}

export function getVerbose() {
    return g.verbose ?? false;
}

export function setVerbose(verbose: boolean) {
    g.verbose = verbose;
}

export function getHostWriter(): IAnsiWriter {
    g.hostWriter ??= new AnsiWriter();
    return g.hostWriter!;
}

export function setHostWriter(writer: IAnsiWriter) {
    g.hostWriter = writer;
}
