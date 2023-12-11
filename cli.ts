import { Command } from "./deps.cli.ts";
import { red } from "./deps.ts";
import { run } from "./runners/console-runner.ts";
import { IRunnerOptions } from "./runners/types.ts";

const program = new Command();
program.name("fire");

program
    .globalOption("--debug", "Enable debug mode")
    .globalOption("--trace", "Enable trace mode")
    .arguments("[targets...]")
    .option("-e, --env <...env:string>", "Sets an environment variable")
    .option("-f, --fire-file <fireFile:string>", "Sets the fire file")
    .option("-ef, --env-file <...envFile:string>", "Sets an environment variable from a file")
    .option("-l, --list", "List Targets")
    .option("-v, --version", "Print the version of the task runner")
    .option("--skip-needs", "Skips all task dependencies")
    .option("--cwd <cwd:string>", "Sets the working directory")
    .option("-t --timeout <timeout:number>", "The timeout in seconds for the task runner to complete")
    .option("--job", "Run jobs")
    .option("--task", "Run tasks")
    .option("--params", "Parameters to pass to a given task")
    .error((err) => {
        if (err && err.stack)
            console.log(red(err.stack));
        else if (err)
            console.log(red(err.message));
    
        Deno.exit(1);
    })
    .action(async (
        {
            env,
            envFile,
            list,
            version,
            skipNeeds,
            timeout,
            job,
            task,
            fireFile,
            cwd,
        },
        ...targets
    ) => {
        const options: IRunnerOptions = {
            env,
            envFile,
            list,
            version,
            skipNeeds,
            timeout,
            job,
            task,
            fireFile,
            workingDirectory: cwd,
        };
        
        return await run(targets, options);
    });

if (import.meta.main) {
    const args = Deno.args;
    try {
        await program.parse(args);
    } catch (e) {
        console.error(e);
        Deno.exit(1);
    }

    Deno.exit(0);
}
