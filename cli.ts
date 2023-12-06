import { TaskCollection } from "./tasks/task-collection.ts";
import { AnsiWriter } from "./deps.ts";
import { handleArgs, run, setHostWriter, setTasks } from "./runners/mod.ts";

if (import.meta.main) {
    const hostWriter = new AnsiWriter();
    setTasks(new TaskCollection());
    setHostWriter(new AnsiWriter());
    const options = handleArgs(Deno.args, hostWriter);
    if (!options.taskFile) {
        let pwd = Deno.cwd();
        if (pwd.startsWith("http")) {
            const url = new URL(pwd);
            pwd = url.pathname;
        }

        options.taskFile = `${pwd}/gsrun.ts`;
    }

    const exitCode = await run(options);
    Deno.exit(exitCode);
}
