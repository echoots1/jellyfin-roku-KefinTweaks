// Builds a signed .pkg for installing the app as a private Roku beta channel.
//
//   node scripts/kefin-package.mjs
//
// Needs, in the environment or .env: ROKU_IP, ROKU_PASSWORD (developer mode password) and
// ROKU_SIGNING_PASSWORD (printed by `genkey` on the Roku). ROKU_DEV_ID is optional; when set, the
// script checks the Roku holds that signing key before packaging.
//
// Roku signs packages on the device with the key genkey created there, so this has to run on the
// same network as the Roku. Each run gets a new build_version (yymmddHHMM) so uploads always go up.
// Pass --no-build to package the last build.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, explainFailure, outDir, requireSettings, rokuDeploy, sideload, stagingDir } from './kefin-roku.mjs';

const settings = requireSettings(['ROKU_IP', 'ROKU_PASSWORD', 'ROKU_SIGNING_PASSWORD']);
const host = settings.ROKU_IP;
const password = settings.ROKU_PASSWORD;
const devId = process.env.ROKU_DEV_ID;

build();

// Stamp the staged manifest only; the committed manifest stays as it is
const manifestPath = join(stagingDir, 'manifest');
const now = new Date();
const pad = (value) => String(value).padStart(2, '0');
const buildVersion = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
const manifest = readFileSync(manifestPath, 'utf8').replace(/^build_version=.*$/m, `build_version=${buildVersion}`);
writeFileSync(manifestPath, manifest);
const major = /^major_version=(\d+)/m.exec(manifest)?.[1] ?? '0';
const minor = /^minor_version=(\d+)/m.exec(manifest)?.[1] ?? '0';
const version = `${major}.${minor}.${buildVersion}`;

try {
    const deviceDevId = await rokuDeploy.getDevId({ host });
    if (!deviceDevId) {
        console.error(`The Roku has no signing key yet. Run: nc ${host} 8080   then type: genkey`);
        process.exit(1);
    }
    if (devId && deviceDevId !== devId) {
        console.error(`The Roku is keyed with DevID ${deviceDevId}, not ROKU_DEV_ID ${devId}.`);
        console.error('Use the matching DevID/password, or re-key the Roku with a package signed by the other key.');
        process.exit(1);
    }

    await sideload(host, password);

    console.log('Asking the Roku to sign the package...');
    const pkgPath = await rokuDeploy.signExistingPackage({ host, password, signingPassword: settings.ROKU_SIGNING_PASSWORD, stagingDir });
    const outFile = `kefintweaks-roku-${version}`;
    const savedTo = await rokuDeploy.retrieveSignedPackage(pkgPath, { host, password, outDir, outFile });

    console.log(`Signed package: ${savedTo}`);
    console.log('Upload it at developer.roku.com > Beta Channel (create one the first time), then install it on the TV with the access code.');
} catch (error) {
    if (/password/i.test(error.message)) console.error('Check ROKU_SIGNING_PASSWORD (the password genkey printed).');
    explainFailure(error);
}
