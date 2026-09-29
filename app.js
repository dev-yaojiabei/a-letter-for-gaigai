(() => {
  'use strict';
  const chapters = window.LETTER;
  const lines = chapters.flatMap((chapter, chapterIndex) => chapter.paragraphs.flatMap((text, paragraph) => (text.match(/[^。！？]+[。！？]+[”’」』]*|[^。！？]+$/gu) || []).map(text => ({text, chapter:chapterIndex, paragraph}))));
  const el = id => document.getElementById(id);
  const starts = chapters.map((_, i) => lines.findIndex(line => line.chapter === i));
  const ends = starts.map((_, i) => i === starts.length - 1 ? lines.length - 1 : starts[i + 1] - 1);
  let index = 0, playing = false, timer = null, rest = false, entered = false, renderedIndex = -1;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const storageKey='gaigai-letter-bookmark-v1';
  let bookmark=false, closing=false, quoteURL=null, quoteGeneration=0;
  try {
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved && typeof saved.text==='string'){
      const found=Number.isInteger(saved.index)&&lines[saved.index]?.text===saved.text?saved.index:lines.findIndex(line=>line.text===saved.text);
      if(found>=0){index=found;bookmark=true;}
    }
  }catch(_){}
  function savePlace(){
    try{localStorage.setItem(storageKey,JSON.stringify({index,text:lines[index].text}));bookmark=true;return true;}catch(_){return false;}
  }
  function arrivalLabel(saved=true){
    document.querySelector('.open-hint').textContent=bookmark?'从上次那句接着读 ↗':'轻轻打开 ↗';
    el('openLetter').setAttribute('aria-label',bookmark?'拆开信，接着上次读到的那一句':'拆开写给盖盖的信，开始逐句阅读');
    if(bookmark)document.querySelector('.arrival-note').textContent=saved?`停在第${chapters[lines[index].chapter].number}节，第 ${index+1} 句。`:'信先收好了。这次浏览器没能保存进度，请先别关闭页面。';
  }
  chapters.forEach((chapter, i) => {
    el('chapter').add(new Option(chapter.number, String(i)));
    const button = document.createElement('button'); button.textContent = chapter.number;
    button.setAttribute('aria-label', `读第${chapter.number}节`);
    button.addEventListener('click', () => jump(i)); el('chapterNav').append(button);

    chapter.paragraphs.forEach(text => { const p = document.createElement('p'); p.textContent = text; el('fullContent').append(p); });
  });
  const music=el('backgroundMusic');
  let musicOff=false;
  try{musicOff=localStorage.getItem('gaigai-music-off')==='true';}catch(_){}
  music.volume=0.22;
  function syncMusic(){
    for(const id of ['musicToggle','fullMusicToggle']){
      el(id).textContent=music.paused?'♫ 音乐':'♫ 关闭音乐';
      el(id).setAttribute('aria-pressed',String(!music.paused));
      el(id).setAttribute('aria-label',music.paused?'播放背景音乐':'关闭背景音乐');
    }
  }
  function startMusic(){
    if(musicOff)return;
    el('musicStatus').textContent='';
    music.play().catch(()=>{syncMusic();el('musicStatus').textContent='点音乐按钮播放';});
  }
  function toggleMusic(){
    musicOff=!music.paused;
    try{localStorage.setItem('gaigai-music-off',String(musicOff));}catch(_){}
    if(musicOff)music.pause();else startMusic();
    syncMusic();
  }
  ['musicToggle','fullMusicToggle'].forEach(id=>el(id).addEventListener('click',toggleMusic));
  ['play','pause'].forEach(event=>music.addEventListener(event,syncMusic));
  music.addEventListener('error',()=>{syncMusic();el('musicStatus').textContent='音乐暂时无法播放';});
  syncMusic();
  function stopTimer(){clearTimeout(timer);timer=null;}
  function schedule(){
    stopTimer(); if (!playing || document.hidden || !entered || el('fullDialog').open || el('coverDialog').open || el('quoteDialog').open) return;
    const duration = Math.max(2500, 900 + [...lines[index].text].length * 150) / Number(el('speed').value);
    timer=setTimeout(() => {
      if (index === ends[lines[index].chapter]) { playing=false; rest=true; sync(); }
      else { index++; render(); }
    },duration);
  }
  function sync(){
    const chapter = lines[index].chapter, ended = index === lines.length - 1 && rest;
    el('chapter').value=String(chapter);el('count').textContent=`${index+1} / ${lines.length} 句`;
    el('prev').disabled=index===0;el('next').disabled=index===lines.length-1;
    el('playLabel').textContent=ended?'再读一遍':rest?'继续下一节':playing?'暂停一下':entered?'接着读':'开始读';
    el('playIcon').textContent=playing?'Ⅱ':'▷';el('play').setAttribute('aria-pressed',String(playing));
    el('note').textContent=ended?'全文完':rest?'本节完':playing?'':'已暂停';
    el('chapterProgress').textContent=`${index-starts[chapter]+1} / ${ends[chapter]-starts[chapter]+1}`;
    el('writingMark').classList.toggle('active',playing);
    el('progress').max=lines.length;el('progress').value=index+1;el('percent').textContent=`${Math.round((index+1)/lines.length*100)}%`;
    [...el('chapterNav').children].forEach((button,i)=>button.setAttribute('aria-current',String(i===chapter)));
    schedule();
  }
  function appendLine(i,animate){
    const line=lines[i];let p=el('sentences').lastElementChild;
    if (!p || Number(p.dataset.paragraph)!==line.paragraph){p=document.createElement('p');p.dataset.paragraph=line.paragraph;el('sentences').append(p);}
    const span=document.createElement('span');span.dataset.line=String(i);span.textContent=line.text;if(animate)span.className='new';p.append(span);
  }
  function render(){
    const chapter=lines[index].chapter;
    const appendOnly=renderedIndex===index-1 && renderedIndex>=0 && lines[renderedIndex].chapter===chapter;
    if(appendOnly) appendLine(index,true);
    else {el('sentences').replaceChildren();for(let i=starts[chapter];i<=index;i++)appendLine(i,i===index);}
    el('chapterHeading').textContent=chapters[chapter].number;
    const sameChapter=renderedIndex>=0 && lines[renderedIndex].chapter===chapter;
    renderedIndex=index;savePlace();sync();
    requestAnimationFrame(()=>el('paperScroll').scrollTo({top:el('paperScroll').scrollHeight,behavior:reducedMotion||!sameChapter?'instant':'smooth'}));
  }
  function toggle(){
    if(rest){index=index===lines.length-1?0:index+1;rest=false;playing=true;render();return;}
    playing=!playing;sync();
  }
  function move(delta){stopTimer();rest=false;playing=false;index=Math.min(lines.length-1,Math.max(0,index+delta));render();}
  function jump(chapter){index=starts[chapter];rest=false;playing=false;render();}
  function pause(){if(playing){playing=false;sync();}}
  function openDialog(id){pause();el(id).showModal();}
  function enter(){
    if(closing||el('arrival').classList.contains('leaving'))return;
    startMusic();
    el('arrival').classList.add('leaving');
    setTimeout(()=>{el('arrival').hidden=true;el('reading').hidden=false;entered=true;playing=true;rest=false;render();el('paperScroll').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});},reducedMotion?0:580);
  }
  el('openLetter').addEventListener('click',enter);
  el('backEnvelope').addEventListener('click',()=>{
    if(closing)return;closing=true;pause();music.pause();const saved=savePlace();entered=false;
    el('reading').inert=true;el('reading').classList.add('folding');
    setTimeout(()=>{
      el('reading').hidden=true;el('reading').classList.remove('folding');el('reading').inert=false;
      el('arrival').hidden=false;el('arrival').classList.remove('leaving');arrivalLabel(saved);
      el('arrival').classList.add('returned');window.scrollTo({top:0,behavior:'instant'});
      el('openLetter').focus({preventScroll:true});closing=false;
      setTimeout(()=>el('arrival').classList.remove('returned'),1000);
    },reducedMotion?0:950);
  });
  el('play').addEventListener('click',toggle);el('prev').addEventListener('click',()=>move(-1));el('next').addEventListener('click',()=>move(1));
  el('chapter').addEventListener('change',()=>jump(Number(el('chapter').value)));el('speed').addEventListener('change',schedule);
  el('openFull').addEventListener('click',()=>{startMusic();openDialog('fullDialog');});el('closeFull').addEventListener('click',()=>el('fullDialog').close());
  el('fullDialog').addEventListener('close',()=>{if(!entered)music.pause();});
  window.addEventListener('pagehide',()=>music.pause());
  el('openCover').addEventListener('click',()=>openDialog('coverDialog'));el('closeCover').addEventListener('click',()=>el('coverDialog').close());
  for(const id of ['fullDialog','coverDialog','quoteDialog'])el(id).addEventListener('click',e=>{if(e.target!==el(id))return;const r=el(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el(id).close();});
  el('paperScroll').addEventListener('wheel',pause,{passive:true});el('paperScroll').addEventListener('touchmove',pause,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('keydown',e=>{if(!entered||el('fullDialog').open||el('coverDialog').open||el('quoteDialog').open||['SELECT','BUTTON','INPUT','TEXTAREA','A'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();toggle();}if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}});
  let hold=null, holdTimer=null;
  function cancelHold(){clearTimeout(holdTimer);holdTimer=null;hold=null;}
  el('sentences').addEventListener('pointerdown',e=>{
    const span=e.target.closest('[data-line]');if(!span||!e.isPrimary||e.button!==0)return;
    cancelHold();pause();hold={x:e.clientX,y:e.clientY,id:e.pointerId};
    holdTimer=setTimeout(()=>{cancelHold();showQuote(Number(span.dataset.line));},550);
  });
  document.addEventListener('pointermove',e=>{if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>9)cancelHold();},{passive:true});
  ['pointerup','pointercancel'].forEach(event=>document.addEventListener(event,cancelHold,{passive:true}));
  el('paperScroll').addEventListener('scroll',cancelHold,{passive:true});
  el('sentences').addEventListener('contextmenu',e=>{if(e.target.closest('[data-line]'))e.preventDefault();});
  el('keepCurrent').addEventListener('click',()=>showQuote(index));
  el('closeQuote').addEventListener('click',()=>el('quoteDialog').close());
  el('quoteDialog').addEventListener('close',()=>{quoteGeneration++;document.querySelectorAll('.kept').forEach(span=>span.classList.remove('kept'));});
  function wrapText(ctx,text,maxWidth){
    const rows=[];let row='';
    for(const char of [...text]){
      if(row&&ctx.measureText(row+char).width>maxWidth&&!/[，。！？；：、”’）》]/u.test(char)){rows.push(row);row=char;}
      else row+=char;
    }
    if(row)rows.push(row);return rows;
  }
  async function showQuote(i){
    pause();cancelHold();const generation=++quoteGeneration;
    document.querySelectorAll('.kept').forEach(span=>span.classList.remove('kept'));
    document.querySelector(`[data-line="${i}"]`)?.classList.add('kept');
    el('quotePreview').hidden=true;el('downloadQuote').hidden=true;el('quoteStatus').textContent='正在生成…';
    if(!el('quoteDialog').open)el('quoteDialog').showModal();
    try{
      await document.fonts.ready;
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      const font='LetterWenKai, "Kaiti SC", STKaiti, serif';
      ctx.font=`48px ${font}`;const rows=wrapText(ctx,lines[i].text,840);
      canvas.width=1080;canvas.height=Math.max(1350,570+rows.length*86);
      const h=canvas.height;ctx.fillStyle='#f5eddf';ctx.fillRect(0,0,1080,h);
      ctx.strokeStyle='#d4bfa2';ctx.lineWidth=2;ctx.strokeRect(48,48,984,h-96);
      ctx.fillStyle='#8c684a';ctx.font=`italic 35px ${font}`;ctx.fillText('To：盖盖',120,160);
      ctx.fillStyle='#a98763';ctx.fillRect(120,210,68,2);
      ctx.fillStyle='#493e33';ctx.font=`48px ${font}`;
      const top=300+Math.max(0,(h-660-rows.length*86)/2);
      rows.forEach((row,n)=>ctx.fillText(row,120,top+n*86));
      ctx.fillStyle='#9b7d5f';ctx.fillRect(120,h-235,840,1);
      ctx.font=`27px ${font}`;ctx.fillText('后来，她没有一直陪着你',120,h-170);
      ctx.font=`24px ${font}`;ctx.fillStyle='#887b6d';ctx.fillText(`第${chapters[lines[i].chapter].number}节 · 留住一句话`,120,h-118);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('empty')),'image/png'));
      if(generation!==quoteGeneration)return;
      if(quoteURL)URL.revokeObjectURL(quoteURL);quoteURL=URL.createObjectURL(blob);
      el('quotePreview').src=quoteURL;el('quotePreview').alt=lines[i].text;el('quotePreview').hidden=false;
      el('downloadQuote').href=quoteURL;el('downloadQuote').hidden=false;
      el('quoteStatus').textContent='';
    }catch(_){if(generation===quoteGeneration)el('quoteStatus').textContent='卡片暂时没做好，合上后再试一次。';}
  }
  window.addEventListener('pagehide',()=>{if(entered||bookmark)savePlace();});
  arrivalLabel();
  sync();
})();
