// Builds the app and sideloads it onto a Roku in developer mode.
//
//   ROKU_IP=192.168.1.50 ROKU_PASSWORD=yourDevPassword node scripts/kefin-deploy.mjs
//
// ROKU_IP and ROKU_PASSWORD can also live in a .env file in the repo root (.env is gitignored).
// Pass --no-build to sideload the last build without rebuilding.

import { build, explainFailure, requireSettings, sideload } from './kefin-roku.mjs';

const { ROKU_IP: host, ROKU_PASSWORD: password } = requireSettings(['ROKU_IP', 'ROKU_PASSWORD']);
build();

try {
    await sideload(host, password);
    console.log('Installed. The app is starting on the TV.');
    console.log(`Debug console: telnet ${host} 8085 (or: nc ${host} 8085)   KefinTweaks lines start with [KefinTweaks]`);
} catch (error) {
    explainFailure(error);
}
