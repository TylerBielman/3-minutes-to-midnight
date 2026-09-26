import {mkdir,cp,access,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
await access(join(root,'dist/index.html'));
const release=join(root,'release');
const stage=join(release,`stage-${randomUUID()}`,'3MTM_JERBOA_P1');
await mkdir(join(stage,'scripts'),{recursive:true});
for(const item of ['dist','docs','START_PHONE_TEST.bat','START_PHONE_TEST_HOTEL.bat','README.md']){
  await cp(join(root,item),join(stage,item),{recursive:true});
}
await cp(join(root,'scripts/serve.mjs'),join(stage,'scripts/serve.mjs'));
const zip=join(release,'3MTM_JERBOA_P1.zip');
const temporaryZip=join(release,`package-${randomUUID()}.zip`);
if(process.platform!=='win32')throw new Error('The phone ZIP packager currently requires Windows. npm run build works on any platform.');
// Use the built-in .NET ZIP API; no unsigned script, optional module or policy change.
const result=spawnSync('powershell.exe',['-NoProfile','-Command',
  '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:JERBOA_PACKAGE_SOURCE, $env:JERBOA_PACKAGE_ZIP, [IO.Compression.CompressionLevel]::Optimal, $true)'],
  {stdio:'inherit',windowsHide:true,env:{...process.env,JERBOA_PACKAGE_SOURCE:stage,JERBOA_PACKAGE_ZIP:temporaryZip}});
if(result.error)throw result.error;
if(result.status!==0)throw new Error(`ZIP packaging failed (${result.status})`);
await copyFile(temporaryZip,zip);
console.log(zip);
