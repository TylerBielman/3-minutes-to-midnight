import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {phoneAddresses} from '../scripts/network.mjs';

test('phone addresses prioritize hotspot and omit loopback, IPv6 and unassigned addresses',()=>{
  const ip=(address,extra={})=>({address,family:'IPv4',internal:false,...extra});
  const result=phoneAddresses({WiFi:[ip('10.5.3.233'),ip('fe80::1',{family:'IPv6'})],Loopback:[ip('127.0.0.1',{internal:true})],Waiting:[ip('169.254.1.2')],Hotspot:[ip('192.168.137.1')]});
  assert.deepEqual(result.map(r=>r.address),['192.168.137.1','10.5.3.233']);assert.equal(result[0].hotspot,true);
  assert.deepEqual(phoneAddresses({}),[]);
});

test('server prints phone addresses after binding and retries an occupied port',async()=>{
  const children=[];
  function launch(args){return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/serve.mjs',...args],{windowsHide:true});children.push(child);let output='';
    const timeout=setTimeout(()=>reject(Error(`Server did not start: ${output}`)),5000);
    child.on('error',error=>{clearTimeout(timeout);reject(error);});
    child.stdout.on('data',chunk=>{output+=chunk;const found=output.match(/ready: http:\/\/localhost:(\d+)/);if(found&&output.includes('Keep this window open')){clearTimeout(timeout);resolve({port:Number(found[1]),output});}});
    child.stderr.on('data',chunk=>{output+=chunk;});
    child.on('exit',()=>{clearTimeout(timeout);reject(Error(output));});
  });}
  try{
    const first=await launch(['--port','0']);const second=await launch(['--port',String(first.port),'--auto-port']);
    assert.ok(second.port>first.port);assert.ok(second.port<=first.port+119);
    assert.match(second.output,/ON YOUR PHONE, OPEN/);
    const response=await fetch(`http://localhost:${second.port}/`,{signal:AbortSignal.timeout(3000)});
    // Tests also run in CI before dist exists; serving a built index is checked at packaging.
    assert.ok([200,404].includes(response.status));
  }finally{children.forEach(child=>child.kill());}
});
