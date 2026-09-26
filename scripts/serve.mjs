import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {phoneAddresses} from './network.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const index=process.argv.indexOf('--port');
const firstPort=index<0?5180:Number(process.argv[index+1]);
if(!Number.isInteger(firstPort)||firstPort<0||firstPort>65535)throw new Error('Port must be an integer from 0 to 65535.');
let port=firstPort;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{
  if(error.code==='EADDRINUSE'&&process.argv.includes('--auto-port')&&port<Math.min(firstPort+119,65535)){port++;server.listen(port,'0.0.0.0');return;}
  console.error(error.message);process.exitCode=1;
});
server.on('listening',()=>{
  port=server.address().port;
  console.log(`Jerboa Prototype 1 ready: http://localhost:${port}`);
  console.log('\nON YOUR PHONE, OPEN (use the network your phone joined):');
  const addresses=phoneAddresses();
  for(const entry of addresses)console.log(`  ${entry.hotspot?'PC HOTSPOT':'NETWORK'}: http://${entry.address}:${port}/  (${entry.name})`);
  if(!addresses.length)console.log('  No network address found. Connect Wi-Fi or turn on Mobile Hotspot, then restart this launcher.');
  console.log('\nKeep this window open while playing.\n');
  if(process.argv.includes('--open')&&process.platform==='win32'){
    spawn('explorer.exe',[`http://localhost:${port}`],{windowsHide:true})
      .on('error',()=>console.log('Open the printed address in your browser.'));
  }
});
server.listen(port,'0.0.0.0');
