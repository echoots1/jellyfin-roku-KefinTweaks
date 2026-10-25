// Shared helpers for kefin-deploy.mjs and kefin-package.mjs: settings from .env, build, sideload.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rokuDeployPackage from 'roku-deploy';

export const { rokuDeploy } = rokuDeployPackage;
export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const stagingDir = join(root, 'build', 'staging');
export const outDir = join(root, 'out');
export const zipName = 'kefintweaks-roku.zip';

// Reads KEY=value lines from the repo's .env (gitignored) without overriding real environment variables
export function loadDotEnv() {
    const envPath = join(root, '.env');
    if (!existsSync(envPath)) return;
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
}

export function requireSettings(names) {
    loadDotEnv();
    const missing = names.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        console.error(`Set ${missing.join(' and ')} (environment variables or a .env file in the repo root).`);
        process.exit(1);
    }
    return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

// Builds unless --no-build was passed, and checks there is a build to send
export function build() {
    if (!process.argv.includes('--no-build')) {
        console.log('Building...');
        execSync('npm run build', { cwd: root, stdio: 'inherit' });
    }
    if (!existsSync(join(stagingDir, 'manifest'))) {
        console.error(`No build found in ${stagingDir}. Run without --no-build.`);
        process.exit(1);
    }
}

// Zips the staged build and installs it as the developer app
export async function sideload(host, password) {
    await rokuDeploy.zipFolder(stagingDir, join(outDir, zipName));
    console.log(`Sideloading ${join('out', zipName)} to ${host}...`);
    await rokuDeploy.publish({ host, password, outDir, outFile: zipName, failOnCompileError: true });
}

export function explainFailure(error) {
    console.error(`Failed: ${error.message}`);
    if (/401|Unauthorized/i.test(error.message)) console.error('Check ROKU_PASSWORD (the developer mode password).');
    if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(error.message)) console.error('Check ROKU_IP and that developer mode is enabled.');
    process.exit(1);
}
