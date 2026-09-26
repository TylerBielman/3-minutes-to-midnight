import {networkInterfaces} from 'node:os';
import {pathToFileURL} from 'node:url';

export function phoneAddresses(interfaces=networkInterfaces()){
  return Object.entries(interfaces).flatMap(([name,entries])=>(entries??[])
    .filter(entry=>(entry.family==='IPv4'||entry.family===4)&&!entry.internal&&!entry.address.startsWith('169.254.')&&entry.address!=='0.0.0.0')
    .map(entry=>({name,address:entry.address,hotspot:entry.address.startsWith('192.168.137.')||/Local Area Connection\*|Wi-Fi Direct|Mobile Hotspot/i.test(name)})))
    .sort((a,b)=>Number(b.hotspot)-Number(a.hotspot));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const addresses=phoneAddresses();
  if(process.argv.includes('--hotspot')){const match=addresses.find(a=>a.hotspot);if(match)console.log(match.address);}
  else for(const entry of addresses)console.log(`${entry.address} (${entry.name})`);
}
