// Builds the app and sideloads it onto a Roku in developer mode.
//
//   ROKU_IP=192.168.1.50 ROKU_PASSWORD=yourDevPassword node scripts/kefin-deploy.mjs
//
// ROKU_IP and ROKU_PASSWORD can also live in a .env file in the repo root (.env is gitignored).
// Pass --no-build to sideload the last build without rebuilding.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rokuDeployPackage from 'roku-deploy';

const { rokuDeploy } = rokuDeployPackage;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stagingDir = join(root, 'build', 'staging');
const outDir = join(root, 'out');
const outFile = 'kefintweaks-roku.zip';

function loadDotEnv() {
    const envPath = join(root, '.env');
    if (!existsSync(envPath)) return;
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
}

loadDotEnv();
const host = process.env.ROKU_IP;
const password = process.env.ROKU_PASSWORD;
if (!host || !password) {
    console.error('Set ROKU_IP and ROKU_PASSWORD (environment variables or a .env file in the repo root).');
    process.exit(1);
}

if (!process.argv.includes('--no-build')) {
    console.log('Building...');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

if (!existsSync(join(stagingDir, 'manifest'))) {
    console.error(`No build found in ${stagingDir}. Run without --no-build.`);
    process.exit(1);
}

try {
    await rokuDeploy.zipFolder(stagingDir, join(outDir, outFile));
    console.log(`Sideloading ${join('out', outFile)} to ${host}...`);
    await rokuDeploy.publish({ host, password, outDir, outFile, failOnCompileError: true });
    console.log('Installed. The app is starting on the TV.');
    console.log(`Debug console: telnet ${host} 8085   (KefinTweaks lines start with [KefinTweaks])`);
} catch (error) {
    console.error(`Sideload failed: ${error.message}`);
    if (/401|Unauthorized/i.test(error.message)) console.error('Check ROKU_PASSWORD (the developer mode password).');
    if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/i.test(error.message)) console.error('Check ROKU_IP and that developer mode is enabled.');
    process.exit(1);
}
