import { SecretGenerator, env, homeConfigDir } from "../deps.ts";
import { IExecutionContext } from "../execution/types.ts";
import { IMessageBus } from "../message-bus/mod.ts";
import { DotEnvVault } from "./dotenv.ts";
import { KeePassVault } from "./keepass.ts";
import { SopsVault } from "./sops.ts";
import { IDotEnvOptions, ISecretVault, ISopsOptions, } from "./types.ts";

export function handleVaultSection(model: Record<string, unknown>, ctx: IExecutionContext) {
    if (typeof model["vault"] !== 'object') {
        return undefined
    }

    const vaultModel = model["vault"] as Record<string, string | undefined>
    if (typeof vaultModel["uses"] !== 'string') {
        ctx.bus.error(new Error("Vault 'uses' is required"));
        return undefined;
    }

    const vaultType = vaultModel["uses"] as string;

    switch (vaultType) {
        case 'sops':
            {
                if (typeof vaultModel["uri"] !== 'string') {
                    ctx.bus.debug("Vault url is not set, using default");
                    vaultModel['uri'] = `${homeConfigDir()}/fire/sops.env`
                }

                const sopOptions : ISopsOptions = vaultModel as ISopsOptions
                sopOptions.provider ??= 'age'
                return new SopsVault(sopOptions, ctx);
            }

        case 'keepass':
            {
                if (typeof vaultModel["uri"] !== 'string') {
                    ctx.bus.debug("Vault url is not set, using default");
                    vaultModel['uri'] = `${homeConfigDir()}/fire/default.kdbx`
                }

                const keepassOptions : ISopsOptions = vaultModel as ISopsOptions
                return new KeePassVault(keepassOptions, ctx);
            }

        case 'dotenv':
            {
                if (typeof vaultModel["uri"] !== 'string') {
                    ctx.bus.debug("Vault url is not set, using default");
                    vaultModel['uri'] = `${homeConfigDir()}/fire/secrets.env`
                }

                const dotenvOptions : IDotEnvOptions = vaultModel as IDotEnvOptions;
                return new DotEnvVault(dotenvOptions, ctx);
            }

        default:
            return undefined;
    }
}

export async function handleSecretSection(
    model: Record<string, unknown>, 
    vault: ISecretVault, 
    ctx: IExecutionContext) {
    if (typeof model["secrets"] !== 'object') {
        ctx.bus.debug("No secrets section found");
        return;
    }

    const secretModel = model["secrets"] as Record<string, unknown>;
    const bus = ctx.bus as IMessageBus;
    for(const key in secretModel) {
        const section = secretModel[key]  as Record<string, string | undefined>;
        let path = "";
        let name = key;
        if (typeof section['path'] === 'string') {
            path = section['path']!;
        } else {
            bus.warn(`Secret ${key} is missing path property`);
            continue;
        }

        if (typeof section['name'] === 'string') {
            name = section['name']!;
        }

        let value = await vault.getSecretValue(path);
        if (value === undefined) {
            if (typeof section['env'] === 'string') {
               value = env.get(section['env']!);
            }
            
            if (value === undefined && 
                typeof section['create'] === 'boolean' && 
                section['create'] === true) {
                
                const length = typeof section['length'] === 'number' ? section['length'] : 16;
                const upper = typeof section['upper'] === 'boolean' ? section['upper'] : true;
                const lower = typeof section['lower'] === 'boolean' ? section['lower'] : true;
                const digits = typeof section['digits'] === 'boolean' ? section['digits'] : true;
                let specialChars = '^_-=+~#@|/\\{}'
                let special = true;
                if (section['special']) {
                    if (typeof section['special'] === 'string') {
                        specialChars = section['special']!;
                    } else if (typeof section['special'] === 'boolean') {
                        special = section['special']!;
                    }
                }

                const sg = new SecretGenerator();
                if (upper) {
                    sg.add('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
                }
                if (lower) {
                    sg.add('abcdefghijklmnopqrstuvwxyz');
                }
                if (digits) {
                    sg.add('0123456789');
                }
                if (special) {
                    sg.add(specialChars);
                }
                
                value = sg.generate(length);
                await vault.setSecretValue(path, value);
                bus.info(`Created secret ${path}`);
            }

            if (typeof section['default'] === 'string') {
                value = section['default']!;
                bus.debug(`Using default value for secret ${path}`);
            }
        }

        if (typeof value === 'string') {
           bus.debug(`Setting secret ${name}`);
           ctx.secrets[name] = value;
        } else {
            bus.warn(`Secret ${name} is not set.`);
        }
    }
}