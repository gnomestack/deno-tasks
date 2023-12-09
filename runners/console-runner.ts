import { fs, homeConfigDir, path, ps } from "../deps.ts";
import { IRunnerOptions } from "./types.ts";
import { run as runDeno } from "./console-deno-runner.ts";
import { run as runYaml } from "./console-yaml-runner.ts";

export async function run(targets: string[], options: IRunnerOptions) {
    if (options.fireFile) {
        const ext = path.extname(options.fireFile);
        switch (ext) {
            case ".ts":
                return await runDeno(targets, options);

            case ".yaml":
            case ".yml":
                return await runYaml(targets, options);

            default:
                break;
        }
    }

    const files = [
        path.resolve(ps.cwd, "fire.yaml"),
        path.resolve(ps.cwd, "fire.yml"),
        path.resolve(ps.cwd, "fire.ts"),
        path.resolve(ps.cwd, ".fire", "default.yaml"),
        path.resolve(ps.cwd, ".fire", "default.yml"),
        path.resolve(ps.cwd, ".fire", "default.ts"),
        path.resolve(homeConfigDir(), "fire", "default.yaml"),
        path.resolve(homeConfigDir(), "fire", "default.yml"),
        path.resolve(homeConfigDir(), "fire", "default.ts"),
    ];
    for (const file of files) {
        if (await fs.exists(file)) {
            const ext = path.extname(file);
            switch (ext) {
                case ".ts":
                    return await runDeno(targets, options);

                case ".yaml":
                case ".yml":
                    return await runYaml(targets, options);

                default:
                    return 1;
            }
        }
    }

    return 1;
}
