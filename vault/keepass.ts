import { SecretGenerator, env, equalsIgnoreCase, fs, homeConfigDir, path } from "../deps.ts";
import { IExecutionContext } from "../execution/types.ts";
import { ISecretVault, IKeepassOptions } from "./types.ts";
import kdbx from "npm:kdbxweb@2.1.1";
export { kdbx };

export class KpDatabase {
    #file: string;
    #db: kdbx.Kdbx;

    constructor(file: string, db: kdbx.Kdbx) {
        this.#file = file;
        this.#db = db;
    }

    get rootGroup() {
        return this.#db.getDefaultGroup();
    }

    get db() {
        return this.#db;
    }

    getEntry(path: string, delimiter = "/") {
       
        const segments = path.split(delimiter);
        const title = segments.pop();
        if (!title || title.length === 0) {
            throw new Error("entry title must not be empty");
        }
        let target: kdbx.KdbxGroup = this.rootGroup;
        if (segments.length > 0) {
            target = this.getGroup(segments, delimiter);
        }

        let entry = target.entries.find((o) => {
            const t = o.fields.get("Title");
            let v = "";
            if (typeof t === "string") {
                v = t;
            } else if (t instanceof kdbx.ProtectedValue) {
                v = t.getText();
            }

            return title === v;
        });

        if (!entry) {
            entry = this.#db.createEntry(target);
            entry.fields.set("Title", title);
        }

        return entry;
    }

    getGroup(path: string | string[], delimiter = "/") {
        let target = this.rootGroup;
        const segments = Array.isArray(path) ? path : path.split(delimiter);
        for (let i = 0; i < segments.length; i++) {
            const n = segments[i];
            let found = false;
            for (let j = 0; j < target.groups.length; j++) {
                const g = target.groups[j];
                if (g.name === n) {
                    target = g;
                    found = true;
                    break;
                }
            }

            if (!found) {
                const ng = this.#db.createGroup(target, n);
                target = ng;
            }
        }

        return target;
    }

    findGroup(path: string | string[], ignoreCase = false, delimiter = "/") {
        let target = this.rootGroup;
        const segments = Array.isArray(path) ? path : path.split(delimiter);
        for (let i = 0; i < segments.length; i++) {
            const n = segments[i];
            let found = false;
            for (let j = 0; j < target.groups.length; j++) {
                const g = target.groups[j];
                if ((ignoreCase && equalsIgnoreCase(g.name, n)) || g.name === n) {
                    target = g;
                    found = true;
                    break;
                }
            }

            if (!found) {
                return undefined;
            }
        }

        return target;
    }

    findEntry(path: string, ignoreCase = false, delimiter = "/") {
        const segments = path.split(delimiter);
        const title = segments.pop();
        let target: kdbx.KdbxGroup | undefined = this.rootGroup;
        if (segments.length > 0) {
            target = this.findGroup(segments, ignoreCase);
            if (!target) {
                return undefined;
            }
        }

        return target.entries.find((o) => {
            const t = o.fields.get("Title");
            let v = "";
            if (typeof t === "string") {
                v = t;
            } else if (t instanceof kdbx.ProtectedValue) {
                v = t.getText();
            }

            return (ignoreCase && equalsIgnoreCase(title, v)) || title === v;
        });
    }

    remove(obj: kdbx.KdbxEntry | kdbx.KdbxGroup) {
        this.db.remove(obj);
    }

    static async create(file: string, creds: kdbx.Credentials, name?: string): Promise<KpDatabase> {
        name ??= path.basenameWithoutExtension(file);
        const dir = path.dirname(file);
        await fs.ensureDirectory(dir);
        const kdb = kdbx.Kdbx.create(creds, name);
        kdb.setKdf(kdbx.Consts.KdfId.Aes);
        const db = new KpDatabase(file, kdb);
        await db.save();
        return db;
    }

    static async open(file: string, creds: kdbx.Credentials): Promise<KpDatabase> {
        const binaryDb = await fs.readFile(file);
        const existingDb = await kdbx.Kdbx.load(binaryDb.buffer, creds);
        kdbx.Kdbx.load
        return new KpDatabase(file, existingDb);
    }

    async save() {
        const buffer = await this.#db.save();
        const dir = path.dirname(this.#file);
        await fs.ensureDirectory(dir);
        await fs.writeFile(this.#file, new Uint8Array(buffer));
    }
}

export class KeePassVault  implements ISecretVault {
    #options: IKeepassOptions;
    #kdbx: KpDatabase | undefined;
    #ctx: IExecutionContext;
    
    constructor(options: IKeepassOptions, ctx: IExecutionContext) {
        this.#options = options;
        this.#ctx = ctx;
    }

    
    get supportsSync() {
        return false;
    };

    async getSecretValue(name: string): Promise<string | undefined> {
        await this.load();
        const n = this.normalize(name);
        const entry = this.#kdbx!.findEntry(n);
        if (!entry) {
            return undefined;
        }

        const v = entry.fields.get("Password");
        if (!v) {
            return undefined;
        }
        if (v instanceof kdbx.ProtectedValue) {
            return v.getText();
        }

        return v;
    }
    getSecretValueSync(_name: string): string | undefined {
        throw new Error("Method not implemented.");
    }

    async setSecretValue(name: string, value: string): Promise<void> {
        await this.load();
        const n = this.normalize(name);
        const entry = this.#kdbx?.getEntry(n);
        if (!entry) {
            throw new Error(`Entry not found: ${n}`);
        }

        entry.fields.set("Password", kdbx.ProtectedValue.fromString(value));
        await this.#kdbx!.save();
    }

    setSecretValueSync(_name: string, _value: string): void {
        throw new Error("Method not implemented.");
    }
    async deleteSecret(name: string): Promise<void> {
        await this.load();
        const n = this.normalize(name);
        const entry = this.#kdbx?.findEntry(n);
        if (entry)
        {
            this.#kdbx!.remove(entry);
            await this.#kdbx!.save();
        }
    }

    deleteSecretSync(_name: string): void {
        throw new Error("Method not implemented.");
    }
    async listSecrets(): Promise<string[]> {
        await this.load();
        const group = this.#kdbx?.db.getDefaultGroup();
        if (!group) {
            return [];
        }

        const result: string[] = [];
        for (const entry of group.entries) {
            const v = entry.fields.get("Title");
            if (v) {
                result.push(v.toString());
            }
        }

        for(const g of group.groups) {
            this.collect(g, result);
        }

        return result;
    }
    listSecretsSync(): string[] {
        throw new Error("Method not implemented.");
    }


    async load() {
        if (this.#kdbx) {
            return;
        }

        const file =  this.#options.uri !== undefined ? 
            env.expand(this.#options.uri):
            undefined;

        if (!file) {
            const error = Error("Missing vault.uri property which is required for keepass vault path");
            this.#ctx.bus.error(error);
            return;
        }

        if (! await fs.exists(file)) {
            if (this.#options.create) {
                
                if (!this.#options.passwordFile) {
                    const kdbxName = path.basename(file);
                    this.#options.passwordFile = path.join(homeConfigDir(), "fire", `${kdbxName}.password`);
                }

                const pwFile = env.expand(this.#options.passwordFile);
                
                
                
                if (! await fs.exists(pwFile)) {
                    const sg = new SecretGenerator();
                    sg.addDefaults();
                    const pw = sg.generate(32);
                    await fs.ensureDirectory(path.dirname(pwFile));
                    await fs.writeTextFile(pwFile, pw);
                    this.#ctx.bus.info(`Created password file: ${this.#options.passwordFile}`);
                }

                const pw2 = await fs.readTextFile(pwFile);
                const creds = new kdbx.Credentials(kdbx.ProtectedValue.fromString(pw2));
                this.#kdbx = await KpDatabase.create(file, creds);
                await this.#kdbx.save();
                return;
            }

            throw new Error(`KeePass database not found and create is not set to true: ${file}`);
        }

        let password : string | undefined = undefined;
        let keyFile : Uint8Array | undefined = undefined; 
        if (!this.#options.passwordFile) {
            const kdbxName = path.basename(file);
            this.#options.passwordFile = path.join(homeConfigDir(), "fire", `${kdbxName}.password`);
        }

        if (this.#options.passwordFile)
        {
            const pwFile = env.expand(this.#options.passwordFile);
            password = await fs.readTextFile(pwFile);
        }
            
        if (this.#options.keyFile)
        {
            const keyFilePath = env.expand(this.#options.keyFile);
            keyFile = await fs.readFile(keyFilePath);
        }

        if (env.has("KEEPASS_PASSWORD"))
            password = env.get("KEEPASS_PASSWORD");

        if (env.has("KEEPASS_KEYFILE")) {
            if (! fs.exists(env.get("KEEPASS_KEYFILE")!))
                this.#ctx.bus.warn(`Keyfile not found for env 'KEEPASS_KEYFILE': ${env.get("KEEPASS_KEYFILE")!}`);
            else 
                keyFile = await fs.readFile(env.get("KEEPASS_KEYFILE")!);
        }
            

        let creds : kdbx.Credentials;
        if (password && keyFile)
            creds = new kdbx.Credentials(kdbx.ProtectedValue.fromString(password), keyFile);
        else if (password)
            creds = new kdbx.Credentials(kdbx.ProtectedValue.fromString(password));
        else
            throw new Error("Missing password or key file");

        this.#kdbx = await KpDatabase.open(file, creds);
    }

    collect(group: kdbx.KdbxGroup, result: string[], prefix = "") {
        prefix += group.name + ".";
        for (const entry of group.entries) {
            const v = entry.fields.get("Title");
            if (v) {
                result.push(`${prefix}/${v.toString()}`);
            }
        }

        for (const g of group.groups) {
            this.collect(g, result, prefix);
        }
    }

    normalize(name: string): string {
        return name.toLowerCase().replaceAll(/\.|_|-|\s/g, '/');
    }
}