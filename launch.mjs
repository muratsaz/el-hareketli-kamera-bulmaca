import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const url='http://127.0.0.1:5178';
async function isReady(){try{const response=await fetch(url,{signal:AbortSignal.timeout(700)});return response.ok&&(await response.text()).includes('Kare — Ellerinde bir bulmaca');}catch{return false;}}
if(!await isReady()){
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,stdio:'ignore',windowsHide:true});child.unref();
  for(let i=0;i<40&&!await isReady();i++)await new Promise(resolve=>setTimeout(resolve,250));
}
if(await isReady()){
  spawn('cmd.exe',['/c','start','',url],{stdio:'ignore',windowsHide:true}).unref();
  console.log('Kare tarayıcıda açıldı: '+url);
}else{console.error('Sunucu açılamadı. 5178 portunu başka bir uygulama kullanıyor olabilir.');process.exitCode=1;}
