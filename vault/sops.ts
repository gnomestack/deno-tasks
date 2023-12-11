import { FileNotFoundExeception, dotenv, env, fs, homeConfigDir, isNullOrWhiteSpace, path, ps } from "../deps.ts";
import { IExecutionContext } from "../execution/types.ts";
import { ISecretVault, ISopsOptions } from "./types.ts";

export class SopsVault implements ISecretVault {
    #options: ISopsOptions;
    #loaded: boolean;
    #secrets: Record<string, string>;
    #ctx: IExecutionContext;

    constructor(options: ISopsOptions, ctx: IExecutionContext) {
        this.#loaded = false;
        this.#options = options;
        this.#secrets = {};
        this.#ctx = ctx;
    }
    
    get supportsSync() {
        return true;
    }

    async getSecretValue(name: string): Promise<string> {
        await this.load()
        const n = this.normalize(name);
        return this.#secrets[n];
    }
    getSecretValueSync(name: string): string {
        this.loadSync();
        const n = this.normalize(name);
        return this.#secrets[n];
    }

    async setSecretValue(name: string, value: string): Promise<void> {
        await this.load();
        const n = this.normalize(name);
        this.#secrets[n] = value;
        await this.save();
    }

    setSecretValueSync(name: string, value: string): void {
        this.loadSync();
        const n = this.normalize(name);
        this.#secrets[n] = value;
        this.saveSync();
    }

    async deleteSecret(name: string): Promise<void> {
        await this.load()
        const n = this.normalize(name);
        delete this.#secrets[n];
        await this.save();
    }

    deleteSecretSync(name: string): void {
        this.loadSync();
        const n = this.normalize(name);
        delete this.#secrets[n];
        this.saveSync();
    }

    async listSecrets(): Promise<string[]> {
        await this.load()
        const keys : string[] = []
        for (const key of Object.keys(this.#secrets)) {
            if (this.#secrets[key] !== undefined) {
                keys.push(this.reverseNormalize(key));
            }
        }

        return keys;
    }

    listSecretsSync(): string[] {
        this.loadSync();
        const keys : string[] = []
        for (const key of Object.keys(this.#secrets)) {
            if (this.#secrets[key] !== undefined) {
                keys.push(this.reverseNormalize(key));
            }
        }

        return keys;
    }

    async save() {
        if (!this.#options.uri) {
            throw new Error("Sops uri not set");
        }

        const content = dotenv.stringify(this.#secrets);
        await fs.writeTextFile(this.#options.uri, content);
        env.set('SOPS_AGE_KEY_FILE', this.#options.ageKeyFile!);
        env.set('SOPS_AGE_RECIPIENTS', this.#options.ageRecipient!);
        const r = await ps.exec('sops', ['-e', '-i', this.#options.uri]);
        r.throwOrContinue();
        //await fs.writeTextFile(this.#options.uri, r.stdoutText);
    }

    saveSync() {
        if (!this.#options.uri) {
            throw new Error("Sops uri not set");
        }

        const content = dotenv.stringify(this.#secrets);
        fs.writeTextFileSync(this.#options.uri, content);
        const r = ps.execSync('sops', ['-e', '-i', this.#options.uri]);
        r.throwOrContinue();
    }

    async load() {
        if (this.#loaded) {
            return;
        }

        const file = this.#options.uri;

        if (!file) {
            throw new Error("Sops uri not set");
        }

        if (isNullOrWhiteSpace(await ps.which('sops'))) {
            throw new Error("sops is not installed");
        }

        if (this.#options.provider === 'age') {
            if (isNullOrWhiteSpace(await ps.which('age'))) {
                throw new Error("age is not installed");
            }
        }

        if (! await fs.exists(file)) {
            if (this.#options.create) {
                if (this.#options.provider !== 'age')
                    throw new Error("Only age provider supports creating new files");

                this.#options.ageKeyFile ??= `${homeConfigDir()}/sops/age/keys.txt`;
                if (! await fs.exists(this.#options.ageKeyFile)) {
                    await fs.ensureDirectory(path.dirname(this.#options.ageKeyFile));

                    await ps.exec('age-keygen', ['-o', this.#options.ageKeyFile]);
                    this.#ctx.bus.info(`Created sops age key file ${this.#options.ageKeyFile}`);
                }

                if (! this.#options.ageRecipient) {
                    const content = await fs.readTextFile(this.#options.ageKeyFile);
                    const lines = content.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('# public key:')) {
                            this.#options.ageRecipient = line.substring(13).trim();
                            break;
                        }
                    }

                    if (! this.#options.ageRecipient) {
                        throw new Error("No age recipent found and could not find public key in key file");
                    }
                }

                await fs.ensureDirectory(path.dirname(file));
                await fs.writeTextFile(file, `FIRE=true`);
                env.set('SOPS_AGE_KEY_FILE', this.#options.ageKeyFile);
                env.set('SOPS_AGE_RECIPIENTS', this.#options.ageRecipient);
                await ps.exec('sops', ['-e', '-i', file]);
                this.#ctx.bus.info(`Created sops file ${file}`);
                this.#loaded = true;
                return;
            }

            throw new FileNotFoundExeception(file);
        }

        if (this.#options.provider === 'age') {
            if (this.#options.useEnv) {
                if (!env.has('SOPS_AGE_KEY_FILE') && !env.has('SOPS_AGE_KEY')) {
                    throw new Error("SOPS_AGE_KEY_FILE or SOPS_AGE_KEY env variables not set");
                }

                if (!env.has('SOPS_AGE_RECIPIENTS')) {
                    throw new Error("SOPS_AGE_RECIPIENTS env variable not set");
                }
            } 
            else 
            {
                this.#options.ageKeyFile ??= `${homeConfigDir()}/sops/age/keys.txt`;
                if (!this.#options.ageRecipient) {
                    const content = await fs.readTextFile(this.#options.ageKeyFile);
                    const lines = content.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('# public key:')) {
                            this.#options.ageRecipient = line.substring(13).trim();
                            break;
                        }
                    }

                    if (! this.#options.ageRecipient) {
                        throw new Error("No age recipent found and could not find public key in key file");
                    }
                }

                env.set('SOPS_AGE_KEY_FILE', this.#options.ageKeyFile!);
                env.set('SOPS_AGE_RECIPIENTS', this.#options.ageRecipient);
            }
        }

       
        const r = await ps.exec("sops", ["-d", file], { stdout: "piped" });
        r.throwOrContinue();
        const envContent = r.stdoutText;
        const envData = dotenv.parse(envContent);
        for (const [key, value] of Object.entries(envData)) {
            this.#secrets[key] = value;
        }
       
        this.#loaded = true;
    }

    
    loadSync() {
        if (this.#loaded) {
            return;
        }

        if (this.#loaded) {
            return;
        }

        const file = this.#options.uri;

        if (!file) {
            throw new Error("Sops uri not set");
        }

        if (isNullOrWhiteSpace(ps.whichSync('sops'))) {
            throw new Error("sops is not installed");
        }

        if (this.#options.provider === 'age') {
            if (isNullOrWhiteSpace(ps.whichSync('age'))) {
                throw new Error("age is not installed");
            }
        }

        if (!fs.existsSync(file)) {
            if (this.#options.create) {
                if (this.#options.provider !== 'age')
                    throw new Error("Only age provider supports creating new files");

                this.#options.ageKeyFile ??= `${homeConfigDir()}/.config/sops/age/keys.txt`;
                if (!fs.existsSync(this.#options.ageKeyFile)) {
                    fs.ensureDirectorySync(path.dirname(this.#options.ageKeyFile));

                    const r3 = ps.execSync('age-keygen', ['-o', this.#options.ageKeyFile]);
                    r3.throwOrContinue();
                    this.#ctx.bus.info(`Created sops age key file ${this.#options.ageKeyFile}`);
                }

                if (! this.#options.ageRecipient) {
                    const content = Deno.readTextFileSync(this.#options.ageKeyFile);
                    const lines = content.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('# public key:')) {
                            this.#options.ageRecipient = line.substring(13).trim();
                            break;
                        }
                    }

                    if (! this.#options.ageRecipient) {
                        throw new Error("No age recipent found and could not find public key in key file");
                    }
                }

                fs.ensureDirectorySync(path.dirname(file));
                fs.writeTextFileSync(file, `FIRE=true`);
                env.set('SOPS_AGE_KEY_FILE', this.#options.ageKeyFile);
                env.set('SOPS_AGE_KEY', this.#options.ageRecipient);
                ps.execSync('sops', ['-e', '-i', file]);
                this.#ctx.bus.info(`Created sops file ${file}`);
                this.#loaded = true;
                return;
            }

            throw new FileNotFoundExeception(file);
        }

        if (this.#options.provider === 'age') {
            if (this.#options.useEnv) {
                if (!env.has('SOPS_AGE_KEY_FILE') && !env.has('SOPS_AGE_KEY')) {
                    throw new Error("SOPS_AGE_KEY_FILE or SOPS_AGE_KEY env variables not set");
                }

                if (!env.has('SOPS_AGE_RECIPIENTS')) {
                    throw new Error("SOPS_AGE_RECIPIENTS env variable not set");
                }
            } 
            else 
            {
                this.#options.ageKeyFile ??= `${homeConfigDir()}/.config/sops/age/keys.txt`;
                if (!this.#options.ageRecipient) {
                    const content = Deno.readTextFileSync(this.#options.ageKeyFile);
                    const lines = content.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('# public key:')) {
                            this.#options.ageRecipient = line.substring(13).trim();
                            break;
                        }
                    }

                    if (! this.#options.ageRecipient) {
                        throw new Error("No age recipent found and could not find public key in key file");
                    }
                }

                env.set('SOPS_AGE_KEY_FILE', this.#options.ageKeyFile);
                env.set('SOPS_AGE_KEY', this.#options.ageRecipient);
            }
        }

        const r = ps.execSync("sops", ["-d", file], { stdout: "piped" });
        r.throwOrContinue();
        const envContent = r.stdoutText;
        const envData = dotenv.parse(envContent);
        for (const [key, value] of Object.entries(envData)) {
            this.#secrets[key] = value;
        }
       
        this.#loaded = true;
    }

    reverseNormalize(name: string): string {
        return name.toLowerCase().replaceAll(/_|-/g, '.');
    }

    normalize(name: string): string {
        return name.toUpperCase().replaceAll(/-|\s|\./g, "_");
    }
}