const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/insurance-popup-v1.js','utf8');
function environment(options={}) {
  const timers=[], observers=[], session=options.session||new Map(), local=options.local||new Map();
  let document;
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this.isConnected=true;this.visible=true;this.focusCount=0;}
    appendChild(child){this.children.push(child);return child;}
    setAttribute(k,v){this.attrs[k]=v;}
    getAttribute(k){return this.attrs[k]||null;}
    addEventListener(k,f){this.events[k]=f;}
    contains(n){return this.children.some(c=>c===n||c.contains(n));}
    getClientRects(){return this.visible?[{}]:[];}
    getBoundingClientRect(){return this.rect||{left:0,top:0,right:100,bottom:100,width:100,height:100};}
    focus(){this.focusCount++;document.activeElement=this;}
    matches(){return this.tag==='input';}
    querySelector(sel){if(sel==='img')return image;if(sel==='a')return link;return null;}
  }
  class Dialog extends Element {constructor(){super('dialog');this.open=false;}showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}}
  const image=new Element('img');image.src='https://example.test/assets/insurance-consultation-v2.webp';image.alt='보험 상담';
  const link=new Element('a');link.href='https://open.kakao.com/o/szrZKQPi';
  const inline=new Element('aside');inline.attrs['data-insurance-scope']='test-site';
  const prior=new Element(options.input?'input':'button');
  const body=new Element('body'), head=new Element('head');
  const modal=new Element('div');modal.visible=!!options.modal;
  document={readyState:'complete',hidden:!!options.hidden,body,head,activeElement:prior,
    querySelector:()=>options.noInline?null:inline,
    querySelectorAll:()=>modal.visible?[modal]:[],
    getElementById:id=>body.children.find(x=>x.id===id)||null,
    createElement:tag=>tag==='dialog'?new Dialog():new Element(tag)};
  const storage=map=>({getItem:k=>{if(options.storageBlocked)throw Error('blocked');return map.get(k)||null;},setItem:(k,v)=>{if(options.storageBlocked)throw Error('blocked');map.set(k,v);},removeItem:k=>map.delete(k)});
  const now=options.now||Date.parse('2026-10-26T00:00:00Z');
  class Clock extends Date {static now(){return now;}}
  class Observer {constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  const context={document,HTMLDialogElement:Dialog,location:{hostname:'example.test',pathname:options.path||'/'},sessionStorage:storage(session),localStorage:storage(local),Date:Clock,MutationObserver:Observer,getComputedStyle:e=>({display:e.visible?'block':'none',visibility:'visible'}),window:{innerWidth:1200,innerHeight:900,setTimeout:(fn,delay)=>timers.push({fn,delay})}};
  vm.runInNewContext(code,context);
  return {document,session,local,timers,prior,modal,observers,get dialog(){return body.children.find(x=>x.tag==='dialog');},tick(){assert(timers.length);timers.shift().fn();}};
}
let count=0;function test(name,fn){fn();console.log('ok',++count,name);}
test('delays1500ms then shows one image and exactly two controls',()=>{const e=environment();assert.equal(e.dialog.open,false);assert.equal(e.timers[0].delay,1500);e.tick();assert(e.dialog.open);assert.equal(e.dialog.children.length,2);assert.equal(e.dialog.children[1].children.length,2);assert.equal(e.dialog.children[0].rel,'noopener noreferrer sponsored');assert.equal(e.dialog.attrs['aria-label'],'보험 상담 광고');});
test('close restores focus and prevents another page popup this session',()=>{const e=environment();e.tick();e.dialog.children[1].children[0].events.click();assert(!e.dialog.open);assert.equal(e.prior.focusCount,1);assert.equal(environment({session:e.session}).dialog,undefined);});
test('Escape cancels and restores focus',()=>{const e=environment();e.tick();let prevented=false;e.dialog.events.cancel({preventDefault(){prevented=true;}});assert(prevented);assert(!e.dialog.open);assert.equal(e.prior.focusCount,1);});
test('Tab and ShiftTab wrap within popup and stop keyboard bubbling',()=>{const e=environment();e.tick();const first=e.dialog.children[0],last=e.dialog.children[1].children[1];last.focus();let prevented=0,stopped=0;e.dialog.events.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented++;},stopPropagation(){stopped++;}});assert.equal(e.document.activeElement,first);e.dialog.events.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented++;},stopPropagation(){stopped++;}});assert.equal(e.document.activeElement,last);assert.equal(prevented,2);assert.equal(stopped,2);e.dialog.events.keyup({stopPropagation(){stopped++;}});assert.equal(stopped,3);});
test('KST today suppression spans sessions but expires at Korean midnight',()=>{const e=environment({now:Date.parse('2026-10-26T14:59:59Z')});e.tick();e.dialog.children[1].children[1].events.click();assert.equal(e.local.get('insurance-consultation:test-site:hidden-day'),'2026-10-26');assert.equal(environment({local:e.local,now:Date.parse('2026-10-26T14:59:59Z')}).dialog,undefined);assert(environment({local:e.local,now:Date.parse('2026-10-26T15:00:00Z')}).dialog);});
test('existing modal defers popup until closed',()=>{const e=environment({modal:true});e.tick();assert(!e.dialog.open);assert.equal(e.timers[0].delay,1000);e.modal.visible=false;e.tick();assert(e.dialog.open);});
test('offscreen and aria-hidden panels do not block ads',()=>{const e=environment({modal:true});e.modal.rect={left:-100,top:0,right:0,bottom:100,width:100,height:100};e.tick();assert(e.dialog.open);const h=environment({modal:true});h.modal.attrs['aria-hidden']='true';h.tick();assert(h.dialog.open);});
test('new competing modal closes ad without stealing its focus',()=>{const e=environment();e.tick();e.modal.visible=true;e.observers[0].fn();assert(!e.dialog.open);assert.equal(e.prior.focusCount,0);});
test('typing input defers popup',()=>{const e=environment({input:true});e.tick();assert(!e.dialog.open);e.document.activeElement={matches:()=>false,isConnected:false};e.tick();assert(e.dialog.open);});
test('hidden tab waits until visible',()=>{const e=environment({hidden:true});e.tick();assert(!e.dialog.open);e.document.hidden=false;e.tick();assert(e.dialog.open);});
test('unavailable storage safely skips popup',()=>{const e=environment({storageBlocked:true});assert.equal(e.dialog,undefined);assert.equal(e.timers.length,0);});
test('policy admin payment paths excluded',()=>{for(const path of ['/privacy/','/terms.html','/admin','/checkout','/account/settings'])assert.equal(environment({path}).dialog,undefined);});
test('no inline advertisement means no popup',()=>assert.equal(environment({noInline:true}).dialog,undefined));
console.log(count+' behavior checks passed');
