import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const index=process.argv.indexOf('--port');
const port=index<0?5180:Number(process.argv[index+1]);
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
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'0.0.0.0',()=>{
  console.log(`Jerboa Prototype 1 ready: http://localhost:${port}`);
  if(process.argv.includes('--open')&&process.platform==='win32'){
    spawn('explorer.exe',[`http://localhost:${port}`],{windowsHide:true})
      .on('error',()=>console.log('Open the printed address in your browser.'));
  }
});
