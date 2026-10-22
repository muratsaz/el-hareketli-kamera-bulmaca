import {createShuffledTiles,swapTiles,countCorrect,isSolved,formatElapsed,coverMapping,mapLandmark,pinchRatio,frameFromHands} from './puzzle-core.js';
import {createHandTracker} from './hand-tracker.js';

const $ = id => document.getElementById(id);
const scene=$('scene'), video=$('camera'), board=$('board'), overlay=$('handOverlay'), ctx=overlay.getContext('2d');
let stream=null, tracker=null, tracking=false, loadingTracker=false, cameraBusy=false, cameraEpoch=0;
let tiles=[], photo='', moves=0, startAt=0, finishedAt=0, selected=-1, sourceName='';
let drag=null, handGrab=-1, pinched=false, closeFrames=0, openFrames=0, cursor=null, frameHold=null;
let toastTimeout, photoLoadEpoch=0, capturePending=false, captureMode=false;
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,4000);}
function hint(message){$('hintText').textContent=message;}
function updateCameraControl(){
  $('captureButton').disabled=cameraBusy;
  $('captureButton').innerHTML=stream?`<span class="control-icon">⌑</span><span>${captureMode?'Kareyi şimdi yakala':'Yeni kare yakala'}</span><kbd>BOŞLUK</kbd>`:'<span class="control-icon">⌑</span><span>Kamerayı aç</span><span>↗</span>';
}
function resetHands(){if(handGrab>=0){selected=-1;board.querySelectorAll('.selected').forEach(el=>{el.classList.remove('selected');el.setAttribute('aria-pressed','false');});}handGrab=-1;pinched=false;closeFrames=0;openFrames=0;cursor=null;frameHold=null;$('handCursor').hidden=true;$('captureProgress').style.width='0%';ctx.clearRect(0,0,overlay.width,overlay.height);board.querySelectorAll('.target,.dragging').forEach(el=>{el.classList.remove('target','dragging');el.style.transform='';});}
function updateStats(){ $('moveCount').textContent=String(moves).padStart(2,'0');$('correctCount').textContent=String(countCorrect(tiles));$('timer').textContent=formatElapsed(startAt?(finishedAt||performance.now())-startAt:0); }
setInterval(updateStats,250);
function renderBoard(){
  board.replaceChildren();board.classList.toggle('solved',isSolved(tiles));
  tiles.forEach((tile,index)=>{
    const button=document.createElement('button');button.className='tile';button.type='button';button.dataset.index=index;
    button.dataset.piece=tile;button.style.backgroundImage=`url("${photo}")`;button.style.backgroundPosition=`${tile%3*50}% ${Math.floor(tile/3)*50}%`;
    button.classList.toggle('selected',selected===index);button.classList.toggle('correct',tile===index);
    button.setAttribute('aria-label',`${index+1}. konum, ${tile+1}. parça`);button.setAttribute('aria-pressed',String(selected===index));button.disabled=Boolean(finishedAt);
    button.addEventListener('click',event=>{if(event.detail===0)selectTile(index);});
    button.addEventListener('keydown',event=>{const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[event.key];if(step){event.preventDefault();board.children[(index+step+9)%9]?.focus();}});
    board.append(button);
  });updateStats();
}
function newGame(){
  if(!photo)return;captureMode=false;tiles=createShuffledTiles();moves=0;startAt=performance.now();finishedAt=0;selected=-1;drag=null;resetHands();
  $('success').hidden=true;$('welcome').hidden=true;$('captureGuide').hidden=true;$('boardWrap').hidden=false;$('shuffleButton').disabled=false;
  $('boardLabel').textContent='KAREYİ YENİDEN BİRLEŞTİR';renderBoard();updateCameraControl();window.scrollTo({top:0,behavior:'instant'});
  hint(tracking?'Bir parçayı parmaklarınla tut, diğerinin üstüne bırak.':'İki parçaya sırayla tıkla veya birini diğerinin üstüne sürükle.');
}
function setPhoto(data,name){
  photo=data;sourceName=name;$('referenceImage').src=data;$('referenceImage').hidden=false;$('photoEmpty').hidden=true;
  $('photoName').textContent=name;$('photoCount').textContent='01 / 01';scene.classList.toggle('demo-on',!stream);newGame();updateCameraControl();
  $('flash').classList.remove('active');void $('flash').offsetWidth;$('flash').classList.add('active');
}
function performSwap(a,b){
  if(finishedAt||a<0||b<0||a===b)return;tiles=swapTiles(tiles,a,b);moves++;selected=-1;
  if(isSolved(tiles)){
    finishedAt=performance.now();$('boardLabel').textContent='HER PARÇA YERİNİ BULDU';
    $('successDetail').textContent=`${moves} hamle · ${formatElapsed(finishedAt-startAt)} · Güzel bir iş çıkardın.`;
    $('success').hidden=false;hint('Tamamlandı. Yeni bir kareyle yeniden başlayabilirsin.');
  }
  renderBoard();if(finishedAt)$('playAgain').focus({preventScroll:true});
}
function selectTile(index){if(finishedAt)return;if(selected<0){selected=index;renderBoard();board.children[index]?.focus({preventScroll:true});}else if(selected===index){selected=-1;renderBoard();board.children[index]?.focus({preventScroll:true});}else{performSwap(selected,index);if(!finishedAt)board.children[index]?.focus({preventScroll:true});}}
function tileAt(clientX,clientY){const rect=board.getBoundingClientRect();if($('boardWrap').hidden||clientX<rect.left||clientX>=rect.right||clientY<rect.top||clientY>=rect.bottom)return -1;return Math.floor((clientY-rect.top)/rect.height*3)*3+Math.floor((clientX-rect.left)/rect.width*3);}
board.addEventListener('pointerdown',event=>{if(finishedAt||event.button!==0)return;const index=tileAt(event.clientX,event.clientY);if(index<0)return;event.preventDefault();board.setPointerCapture(event.pointerId);drag={index,x:event.clientX,y:event.clientY,moved:false,pointerId:event.pointerId};});
board.addEventListener('pointermove',event=>{if(!drag||drag.pointerId!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>6)drag.moved=true;if(!drag.moved)return;const tile=board.children[drag.index];tile.classList.add('dragging');tile.style.transform=`translate(${dx}px,${dy}px)`;const target=tileAt(event.clientX,event.clientY);[...board.children].forEach((el,i)=>el.classList.toggle('target',i===target&&i!==drag.index));});
board.addEventListener('pointerup',event=>{if(!drag||drag.pointerId!==event.pointerId)return;const state=drag;drag=null;board.releasePointerCapture(event.pointerId);if(state.moved){const target=tileAt(event.clientX,event.clientY);performSwap(state.index,target);renderBoard();}else selectTile(state.index);});
board.addEventListener('pointercancel',()=>{drag=null;renderBoard();});

function mapping(){const rect=scene.getBoundingClientRect();return coverMapping(video.videoWidth,video.videoHeight,rect.width,rect.height);}
function squareFrame(rect){const w=scene.clientWidth,h=scene.clientHeight;const side=Math.min(Math.max(rect.width,rect.height),w-24,h-170);return{x:Math.max(12,Math.min(w-side-12,rect.x+rect.width/2-side/2)),y:Math.max(100,Math.min(h-side-70,rect.y+rect.height/2-side/2)),width:side,height:side};}
function defaultFrame(){const s=Math.min(scene.clientWidth*.7,scene.clientHeight*.52);return{x:(scene.clientWidth-s)/2,y:scene.clientHeight*.49-s/2,width:s,height:s};}
function showGuide(rect=defaultFrame()){$('captureGuide').hidden=false;Object.assign($('captureGuide').style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.width}px`,height:`${rect.height}px`,transform:'none'});}
function enterCapture(){captureMode=true;resetHands();$('welcome').hidden=true;$('boardWrap').hidden=true;$('success').hidden=true;$('shuffleButton').disabled=true;showGuide();$('guideLabel').textContent='İKİ ELİNLE BİR ÇERÇEVE YAP';updateCameraControl();hint('İki elinle çerçeve yap ve sabit tut. İstersen “Kareyi şimdi yakala” düğmesine bas.');window.scrollTo({top:0,behavior:'instant'});}
function capture(rect=defaultFrame()){
  if(!stream||video.readyState<2||capturePending){return;}
  capturePending=true;const map=mapping(),canvas=document.createElement('canvas');canvas.width=canvas.height=900;
  const c=canvas.getContext('2d');c.filter='grayscale(1)';
  c.translate(900,0);c.scale(-1,1);
  const sx=(map.displayWidth-(rect.x+rect.width)-map.offsetX)/map.scale,sy=(rect.y-map.offsetY)/map.scale;
  c.drawImage(video,sx,sy,rect.width/map.scale,rect.height/map.scale,0,0,900,900);
  setPhoto(canvas.toDataURL('image/jpeg',.93),'KAMERANDAN BİR AN');capturePending=false;
}
async function startCamera(){
  if(cameraBusy||stream)return;cameraBusy=true;const epoch=++cameraEpoch;
  $('startCamera').disabled=true;$('startCamera').innerHTML='Kamera açılıyor…';$('cameraError').hidden=true;
  try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('Kamera için güvenli bağlantı veya yerel başlatıcı gerekiyor.'),{name:'SecurityError'});
    const incoming=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
    if(epoch!==cameraEpoch){incoming.getTracks().forEach(t=>t.stop());return;}
    stream=incoming;video.srcObject=stream;await video.play();
    scene.classList.add('camera-on');scene.classList.remove('demo-on');$('liveLabel').textContent='KAMERA CANLI';$('liveDot').classList.add('active');
    $('welcome').hidden=true;$('stopCamera').hidden=false;$('trackingToggle').disabled=false;
    stream.getVideoTracks()[0].addEventListener('ended',()=>{stopCamera();toast('Kamera bağlantısı kapandı. Yeniden açabilir veya fotoğraf yükleyebilirsin.');});
    enterCapture();
    await enableTracking();
  }catch(error){
    stopCamera();
    const messages={NotAllowedError:'Tarayıcıda kamera izni verilmedi. Adres çubuğundaki kamera simgesinden izin verebilir veya bir fotoğraf yükleyebilirsin.',NotFoundError:'Bağlı bir kamera bulunamadı. Fotoğraf yükleyerek ya da örnekle devam edebilirsin.',NotReadableError:'Kamera başka bir uygulamada kullanılıyor olabilir. O uygulamayı kapatıp yeniden dene.',SecurityError:'Kamerayı kullanmak için projenin Başlat.cmd dosyasını aç veya güvenli site bağlantısını kullan.'};
    $('cameraErrorText').textContent=messages[error.name]||'Kamera açılamadı. Bağlantıyı ve tarayıcı izinlerini kontrol edip yeniden dene.';$('cameraError').hidden=false;
    $('welcome').hidden=Boolean(photo);$('captureButton').disabled=true;$('liveLabel').textContent='KAMERA KAPALI';scene.classList.remove('camera-on');
  }finally{cameraBusy=false;updateCameraControl();$('startCamera').disabled=false;$('startCamera').innerHTML='Kamerayı aç <span>↗</span>';}
}
async function enableTracking(){
  if(!stream||loadingTracker)return;loadingTracker=true;$('trackingToggle').disabled=true;
  try{
    if(!tracker)tracker=await createHandTracker({video,onResults:onHands,onStatus:({state,message})=>{
      $('trackingLabel').textContent=message;
      if(state==='error'){tracking=false;$('trackingToggle').setAttribute('aria-checked','false');resetHands();hint('El takibi kullanılamıyor. Fare veya dokunmayla devam edebilirsin.');}
    }});
    if(!stream){tracker.dispose();tracker=null;return;}
    tracking=true;tracker.start();$('trackingToggle').setAttribute('aria-checked','true');$('trackingLabel').textContent='Ellerini kameraya göster';
    if(photo&&!captureMode)hint('Bir parçayı parmaklarınla tut, diğerinin üstüne bırak.');
  }catch(error){tracking=false;$('trackingLabel').textContent='Yüklenemedi · Yeniden denemek için aç';toast('El takibi hazırlanamadı. Bulmacayı fareyle oynayabilirsin.');}
  finally{loadingTracker=false;$('trackingToggle').disabled=!stream;}
}
function stopCamera(){
  cameraEpoch++;tracking=false;tracker?.stop();if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
  scene.classList.remove('camera-on');scene.classList.toggle('demo-on',Boolean(photo));$('liveLabel').textContent='KAMERA KAPALI';$('liveDot').classList.remove('active');
  $('trackingToggle').setAttribute('aria-checked','false');$('trackingToggle').disabled=true;$('trackingLabel').textContent='Kamera kapalı';
  $('captureButton').disabled=true;$('stopCamera').hidden=true;$('captureGuide').hidden=true;$('cameraError').hidden=true;resetHands();
  captureMode=false;if(!photo)$('welcome').hidden=false;else{$('boardWrap').hidden=false;$('shuffleButton').disabled=false;$('success').hidden=!finishedAt;hint('İki parçaya tıkla veya sürükleyerek yerlerini değiştir.');}
  updateCameraControl();
}
function onHands(hands,timestamp){
  if(!tracking||!stream||!video.videoWidth)return;
  const width=scene.clientWidth,height=scene.clientHeight,ratio=window.devicePixelRatio||1;
  if(overlay.width!==Math.round(width*ratio)||overlay.height!==Math.round(height*ratio)){overlay.width=Math.round(width*ratio);overlay.height=Math.round(height*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);const map=mapping();
  hands.forEach(hand=>{const points=hand.map(p=>mapLandmark(p,map));ctx.strokeStyle='#f5f6dfb0';ctx.lineWidth=1.2;ctx.beginPath();connections.forEach(([a,b])=>{ctx.moveTo(points[a].x,points[a].y);ctx.lineTo(points[b].x,points[b].y);});ctx.stroke();points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,i===4||i===8?3.2:1.4,0,Math.PI*2);ctx.fillStyle=i===4||i===8?'#eeef92':'#f6f7e3';ctx.fill();});});
  $('trackingLabel').textContent=hands.length?`${hands.length} el algılandı${pinched?' · Parça tutuluyor':''}`:'Ellerini kameraya göster';
  if(!hands.length){resetHands();if(captureMode){showGuide();$('guideLabel').textContent='İKİ ELİNLE BİR ÇERÇEVE YAP';}return;}
  if(captureMode){
    const frame=frameFromHands(hands,map);if(!frame){frameHold=null;showGuide();$('captureProgress').style.width='0%';$('guideLabel').textContent='İKİ ELİNLE BİR ÇERÇEVE YAP';return;}
    const rect=squareFrame(frame);showGuide(rect);const center={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
    if(!frameHold||Math.hypot(center.x-frameHold.x,center.y-frameHold.y)>50||Math.abs(rect.width-frameHold.width)>65)frameHold={...center,width:rect.width,start:timestamp};
    const progress=Math.min(1,(timestamp-frameHold.start)/1150);$('captureProgress').style.width=`${progress*100}%`;$('guideLabel').textContent='SABİT TUT…';
    if(progress===1){frameHold=null;capture(rect);}return;
  }
  if(finishedAt||drag)return;
  const hand=cursor?[...hands].sort((a,b)=>{const pa=mapLandmark(a[8],map),pb=mapLandmark(b[8],map);return Math.hypot(pa.x-cursor.x,pa.y-cursor.y)-Math.hypot(pb.x-cursor.x,pb.y-cursor.y);})[0]:hands[0];
  const point=mapLandmark({x:(hand[4].x+hand[8].x)/2,y:(hand[4].y+hand[8].y)/2},map);
  cursor=cursor?{x:cursor.x*.35+point.x*.65,y:cursor.y*.35+point.y*.65}:point;
  $('handCursor').hidden=false;$('handCursor').style.left=`${cursor.x}px`;$('handCursor').style.top=`${cursor.y}px`;
  const sceneRect=scene.getBoundingClientRect(),target=tileAt(cursor.x+sceneRect.left,cursor.y+sceneRect.top),pinch=pinchRatio(hand);
  closeFrames=pinch<.30?closeFrames+1:0;openFrames=pinch>.48?openFrames+1:0;
  if(!pinched&&closeFrames>=2){pinched=true;handGrab=target;selected=target;renderBoard();}
  if(pinched&&openFrames>=2){pinched=false;const origin=handGrab;handGrab=-1;selected=-1;performSwap(origin,target);renderBoard();}
  $('handCursor').classList.toggle('pinching',pinched);[...board.children].forEach((el,i)=>el.classList.toggle('target',i===target&&i!==handGrab));
}
function demo(){
  $('cameraError').hidden=true;const c=document.createElement('canvas');c.width=c.height=900;const g=c.getContext('2d');
  const sky=g.createLinearGradient(0,0,0,900);sky.addColorStop(0,'#e0e0d8');sky.addColorStop(1,'#acb2a5');g.fillStyle=sky;g.fillRect(0,0,900,900);
  g.fillStyle='#f2f1e6';g.beginPath();g.arc(635,225,103,0,Math.PI*2);g.fill();
  [[0,590,235,260,520,620,'#7d897c'],[240,680,580,320,900,640,'#647267'],[-100,780,280,480,650,850,'#46584f'],[360,900,760,540,1030,900,'#2d423b']].forEach(([x1,y1,x2,y2,x3,y3,color])=>{g.fillStyle=color;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.lineTo(x3,y3);g.lineTo(900,900);g.lineTo(0,900);g.closePath();g.fill();});
  g.strokeStyle='#e1e2d250';g.lineWidth=2;for(let i=0;i<8;i++){g.beginPath();g.moveTo(0,700+i*25);g.bezierCurveTo(250,660+i*25,480,790+i*15,900,710+i*24);g.stroke();}
  g.fillStyle='#f3f2e1';g.font='500 90px Georgia';g.fillText('kare.',55,125);g.font='18px monospace';g.fillText('BİR ANI BİRLEŞTİR.',58,165);g.font='14px monospace';g.fillText('38° N / 27° E',690,855);
  // Convert once so the puzzle and its reference share identical grayscale pixels.
  const out=document.createElement('canvas');out.width=out.height=900;const final=out.getContext('2d');final.filter='grayscale(1)';final.drawImage(c,0,0);setPhoto(out.toDataURL('image/jpeg',.95),'ÖRNEK KARE / DAĞLAR');
}
$('photoInput').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;const epoch=++photoLoadEpoch;event.target.value='';
  if(!file.type.startsWith('image/')){toast('Lütfen bir fotoğraf dosyası seç.');return;}if(file.size>25*1024*1024){toast('Lütfen 25 MB’den küçük bir fotoğraf seç.');return;}
  const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(epoch!==photoLoadEpoch)return;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=900;const c=canvas.getContext('2d'),side=Math.min(image.naturalWidth,image.naturalHeight);c.filter='grayscale(1)';c.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,900,900);setPhoto(canvas.toDataURL('image/jpeg',.93),'SENİN FOTOĞRAFIN');$('cameraError').hidden=true;
  }catch{toast('Bu fotoğraf açılamadı. JPG, PNG veya WebP deneyebilirsin.');}finally{URL.revokeObjectURL(url);}
});
$('startCamera').addEventListener('click',startCamera);$('retryCamera').addEventListener('click',startCamera);$('stopCamera').addEventListener('click',stopCamera);
$('tryDemo').addEventListener('click',demo);$('shuffleButton').addEventListener('click',newGame);$('playAgain').addEventListener('click',newGame);
$('uploadButton').addEventListener('click',()=>$('photoInput').click());
$('captureButton').addEventListener('click',()=>{if(!stream){startCamera();return;}if(!captureMode)enterCapture();else capture();});
$('trackingToggle').addEventListener('click',()=>{if(tracking){tracking=false;tracker?.stop();resetHands();$('trackingToggle').setAttribute('aria-checked','false');$('trackingLabel').textContent='El takibi kapalı';hint('İki parçaya tıkla veya sürükleyerek yerlerini değiştir.');}else enableTracking();});
$('helpButton').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());$('helpDone').addEventListener('click',()=>$('helpDialog').close());
document.addEventListener('keydown',event=>{if(event.code==='Space'&&stream&&!$('helpDialog').open&&!['BUTTON','INPUT'].includes(document.activeElement.tagName)){event.preventDefault();capture();}if(event.key==='Escape'){selected=-1;resetHands();renderBoard();}});
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());tracker?.dispose();});
window.addEventListener('resize',()=>{if(stream&&captureMode)showGuide();resetHands();});
if(location.protocol==='file:'){$('cameraError').hidden=false;$('cameraErrorText').textContent='Uygulamayı Başlat.cmd dosyasına çift tıklayarak aç. Tarayıcı modülleri için yerel sunucu gerekiyor.';}
