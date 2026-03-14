import { hiragana, extendedHiragana } from './data/hiragana.js';
import { katakana } from './data/katakana.js';
import { wordsHiragana } from './data/words-hiragana.js';
import { wordsKatakana } from './data/words-katakana.js';
import { confusionHiragana } from './data/confusion-hiragana.js';
import { confusionKatakana } from './data/confusion-katakana.js';
import { state, persist } from './core/state.js';
import { go, currentRoute } from './core/router.js';
import { registerResult, accuracy } from './core/stats.js';
import { rows, filterByRow } from './modes/rows.js';
import { createClassicRound } from './modes/classic.js';
import { createReverseRound } from './modes/reverse.js';
import { createWritingRound } from './modes/writing.js';
import { mostMistakenItems } from './modes/mistakes.js';
import { createWordRound } from './modes/words.js';
import { createExtendedRound } from './modes/extendedKana.js';
import { createConfusionRound } from './modes/confusion.js';
import { getTodayKey, buildDailySet } from './modes/dailyChallenge.js';

const app = document.getElementById('app');
let currentRound = null;
let currentMode = null;

const scripts = {
  hiragana: { label:'Hiragana', items: hiragana, extended: extendedHiragana, words: wordsHiragana, confusion: confusionHiragana },
  katakana: { label:'Katakana', items: katakana, extended: [], words: wordsKatakana, confusion: confusionKatakana }
};

function shuffle(arr){ return [...arr].sort(()=>Math.random()-0.5); }
function modeLabel(mode){ return {classic:'Klassischer Modus',reverse:'Umgekehrter Modus',writing:'Schreibmodus',rows:'Reihen-Training',alphabet:'Komplettes Alphabet',mistakes:'Fehlertrainer',words:'Wörter lesen',extended:'Erweiterte Kana',drawing:'Zeichen zeichnen',confusion:'Verwechslungs-Trainer'}[mode] || mode; }
function labelDiff(d){ return d==='easy'?'Einfach':d==='medium'?'Mittel':'Schwer'; }

function btn(label, sub, onClick, extra=''){
  return `<button class="menu-btn ${extra}" data-action="${onClick}"><div class="big">${label}</div><div class="small">${sub}</div></button>`;
}
function statLine(label, value){ return `<div class="list-item"><span>${label}</span><strong>${value}</strong></div>`; }
function difficultyChips(selected){
  return `<div class="row">${['easy','medium','hard'].map(d => `<button class="chip ${selected===d?'active':''}" data-action="difficulty:${d}">${labelDiff(d)}</button>`).join('')}</div>`;
}

function renderShell(title, subtitle, body, backTo='home'){
  app.innerHTML = `<div class="screen"><div class="header"><div><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div>${backTo ? `<button class="nav-btn" data-action="back:${backTo}">Zurück</button>` : ''}</div>${body}</div>`;
  bindActions();
}
function renderHome(){
  const h = state.progress.hiragana;
  renderShell('Kana Trainer','iPhone-optimierte GitHub-App mit Offline-Modus, Fortschritt und mehreren Lernmodi.',`
    <div class="card">
      <div class="top-stats">
        <div class="stat"><div class="stat-label">Hiragana</div><div class="stat-value">${h.learned.length}/46</div></div>
        <div class="stat"><div class="stat-label">Genauigkeit</div><div class="stat-value">${accuracy(h)}%</div></div>
        <div class="stat"><div class="stat-label">Streak</div><div class="stat-value">${h.streak}</div></div>
        <div class="stat"><div class="stat-label">Best</div><div class="stat-value">${h.bestStreak}</div></div>
      </div>
    </div>
    <div class="grid">
      ${btn('Hiragana lernen','Alle Modi für Hiragana','script:hiragana','primary')}
      ${btn('Katakana lernen','Getrenntes Training für Katakana','script:katakana')}
      ${btn('Daily Challenge','20 Tagesfragen mit Ergebnis','daily','warning')}
      ${btn('Statistik','Fortschritt, Fehler und Accuracy','stats')}
      ${btn('Einstellungen','App zurücksetzen und Hinweise','settings')}
    </div>
    <div class="small-note center">Safari auf dem iPhone → Teilen → Zum Home-Bildschirm.</div>
  `,'');
}
function renderScript(script){
  const cfg = scripts[script];
  state.lastSelection.script = script; persist();
  renderShell(cfg.label,'Wähle einen Übungsmodus.',`
    <div class="grid">
      ${btn('Klassischer Modus','Kana → Romaji mit Auswahlantworten',`trainer:${script}:classic`,'primary')}
      ${btn('Umgekehrter Modus','Romaji → Kana mit Auswahlantworten',`trainer:${script}:reverse`)}
      ${btn('Schreibmodus','Mit echter Texteingabe üben',`trainer:${script}:writing`,'primary-soft')}
      ${btn('Reihen-Training','Nur a/ka/sa/… gezielt üben',`trainer:${script}:rows`)}
      ${btn('Komplettes Alphabet','Alle 46 Grundzeichen trainieren',`trainer:${script}:alphabet`)}
      ${btn('Fehlertrainer','Nur deine Problemzeichen',`trainer:${script}:mistakes`,'danger')}
      ${btn('Wörter lesen','Kleine Wörter im Kana lesen',`trainer:${script}:words`)}
      ${btn('Erweiterte Kana','Dakuten, Handakuten und Kombinationen',`trainer:${script}:extended`)}
      ${btn('Zeichen zeichnen','Mit dem Finger nachspuren oder frei üben',`trainer:${script}:drawing`)}
      ${btn('Verwechslungs-Trainer','Ähnliche Zeichen gezielt auseinanderhalten',`trainer:${script}:confusion`,'warning')}
    </div>
  `,'home');
}
function quizCardClassic(round){
  return `<div class="card question-card"><div class="prompt">${round.prompt}</div><div class="big-kana">${round.current.char}</div><div class="answers">${round.options.map(opt=>`<button class="answer-btn" data-answer="${opt}">${opt}</button>`).join('')}</div><div class="result" id="result"></div><div class="footer-actions"><button class="small-btn" data-action="next">Nächste Frage</button></div></div>`;
}
function quizCardReverse(round){
  return `<div class="card question-card"><div class="prompt">${round.prompt}</div><div class="big-kana" style="font-size:3rem">${round.current.romaji}</div><div class="answers">${round.options.map(opt=>`<button class="answer-btn" data-answer="${opt}">${opt}</button>`).join('')}</div><div class="result" id="result"></div><div class="footer-actions"><button class="small-btn" data-action="next">Nächste Frage</button></div></div>`;
}
function quizCardWriting(round){
  const promptText = round.direction === 'kana-to-romaji' ? round.current.char : round.current.romaji;
  const ph = round.direction === 'kana-to-romaji' ? 'z. B. ka' : 'z. B. か';
  return `<div class="card"><div class="row"><button class="chip ${round.direction==='kana-to-romaji'?'active':''}" data-action="writeDir:kana-to-romaji">Kana → Romaji</button><button class="chip ${round.direction==='romaji-to-kana'?'active':''}" data-action="writeDir:romaji-to-kana">Romaji → Kana</button></div></div><div class="card question-card"><div class="prompt">${round.prompt}</div><div class="big-kana" style="font-size:${round.direction==='kana-to-romaji' ? '5rem' : '3rem'}">${promptText}</div><input id="writeInput" class="input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${ph}" /><div class="footer-actions"><button class="small-btn primary" data-action="check-writing">Prüfen</button><button class="small-btn" data-action="next">Nächste Frage</button></div><div class="result" id="result"></div></div>`;
}
function quizCardWords(round){
  return `<div class="card question-card"><div class="prompt">${round.prompt}</div><div class="big-kana" style="font-size:4rem">${round.current.word}</div><input id="writeInput" class="input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Tippe das Romaji" /><div class="footer-actions"><button class="small-btn primary" data-action="check-word">Prüfen</button><button class="small-btn" data-action="next">Nächste Frage</button></div><div class="result" id="result"></div></div>`;
}
function quizCardExtended(round){
  return `<div class="card question-card"><div class="prompt">${round.prompt}</div><div class="big-kana" style="font-size:4.5rem">${round.current.char}</div><div class="answers">${round.options.map(opt=>`<button class="answer-btn" data-answer="${opt}">${opt}</button>`).join('')}</div><div class="result" id="result"></div><div class="footer-actions"><button class="small-btn" data-action="next">Nächste Frage</button></div></div>`;
}
function quizCardConfusion(round){
  return `<div class="card question-card"><div class="prompt">${round.prompt}</div><div class="big-kana">${round.current.romaji}</div><div class="answers">${round.options.map(opt=>`<button class="answer-btn" data-answer="${opt}">${opt}</button>`).join('')}</div><div class="result" id="result"></div><div class="footer-actions"><button class="small-btn" data-action="next">Nächste Frage</button></div></div>`;
}
function drawingCard(round){
  return `<div class="card question-card"><div class="prompt">Zeichne dieses Zeichen nach oder frei aus dem Kopf.</div><div class="big-kana">${round.current.char}</div><div class="canvas-wrap"><div class="kana-ghost" id="ghostKana">${round.current.char}</div><canvas id="drawCanvas" width="700" height="500"></canvas></div><div class="row"><button class="small-btn" data-action="toggle-ghost">Vorlage ein/aus</button><button class="small-btn" data-action="clear-canvas">Löschen</button><button class="small-btn" data-action="mark-drawn">Als geübt markieren</button><button class="small-btn" data-action="next">Nächstes Zeichen</button></div><div class="small-note center">Dieser Modus dient zum Üben, nicht zur automatischen Handschrift-Erkennung.</div><div class="result" id="result"></div></div>`;
}
function renderTrainer(script, mode){
  currentMode = { script, mode };
  const cfg = scripts[script];
  const difficulty = state.lastSelection.difficulty || 'easy';
  let body = '';
  if(mode === 'rows'){
    const row = state.lastSelection.row || 'a';
    const items = filterByRow(cfg.items, row);
    currentRound = createClassicRound(items.length ? items : cfg.items, difficulty);
    body = `<div class="card"><div class="subtitle">Reihe wählen</div><div class="row">${['all', ...rows].map(r=>`<button class="chip ${row===r?'active':''}" data-action="row:${r}">${r==='all'?'alle':r+'-Reihe'}</button>`).join('')}</div></div>${quizCardClassic(currentRound)}`;
  } else if(mode === 'classic' || mode === 'alphabet'){
    currentRound = createClassicRound(cfg.items, difficulty); body = quizCardClassic(currentRound);
  } else if(mode === 'reverse'){
    currentRound = createReverseRound(cfg.items, difficulty); body = quizCardReverse(currentRound);
  } else if(mode === 'writing'){
    currentRound = createWritingRound(cfg.items, difficulty, state.lastSelection.writeDir || 'kana-to-romaji'); body = quizCardWriting(currentRound);
  } else if(mode === 'mistakes'){
    const mItems = mostMistakenItems(cfg.items, state.progress[script].mistakes);
    body = mItems.length ? (currentRound = createClassicRound(mItems, 'hard'), quizCardClassic(currentRound)) : `<div class="card center"><div class="title" style="font-size:1.2rem">Noch keine Fehler gespeichert</div><div class="subtitle">Sobald du Zeichen falsch beantwortest, tauchen sie hier auf.</div></div>`;
  } else if(mode === 'words'){
    currentRound = createWordRound(cfg.words, difficulty); body = quizCardWords(currentRound);
  } else if(mode === 'extended'){
    body = cfg.extended.length ? (currentRound = createExtendedRound(cfg.extended), quizCardExtended(currentRound)) : `<div class="card center"><div class="title" style="font-size:1.2rem">Für Katakana kommt dieser Modus später</div><div class="subtitle">Hiragana enthält hier schon erweiterte Kana.</div></div>`;
  } else if(mode === 'drawing'){
    currentRound = { current: cfg.items[Math.floor(Math.random()*cfg.items.length)] }; body = drawingCard(currentRound);
  } else if(mode === 'confusion'){
    currentRound = createConfusionRound(cfg.confusion); body = quizCardConfusion(currentRound);
  }
  renderShell(cfg.label, `${cfg.label} · ${modeLabel(mode)}`, `<div class="card"><div class="subtitle">Schwierigkeit</div>${difficultyChips(difficulty)}</div>${body}`, `script-${script}`);
  if(mode === 'drawing') initCanvas();
}
function renderStats(){
  const h = state.progress.hiragana, k = state.progress.katakana;
  const mistakes = Object.entries(h.mistakes).sort((a,b)=>b[1]-a[1]).slice(0,8);
  renderShell('Statistik','Fortschritt, Accuracy und häufige Fehler.',`
    <div class="grid-2">
      <div class="card"><div class="title" style="font-size:1.2rem">Hiragana</div><div class="list">${statLine('Gelernt',`${h.learned.length} / 46`)}${statLine('Richtig',h.correct)}${statLine('Falsch',h.wrong)}${statLine('Accuracy',accuracy(h)+'%')}${statLine('Aktuelle Streak',h.streak)}${statLine('Beste Streak',h.bestStreak)}</div><div style="margin-top:12px"><div class="small-note">Fortschritt</div><div class="progress"><div class="progress-bar" style="width:${Math.round((h.learned.length/46)*100)}%"></div></div></div></div>
      <div class="card"><div class="title" style="font-size:1.2rem">Katakana</div><div class="list">${statLine('Gelernt',`${k.learned.length} / 46`)}${statLine('Richtig',k.correct)}${statLine('Falsch',k.wrong)}${statLine('Accuracy',accuracy(k)+'%')}${statLine('Aktuelle Streak',k.streak)}${statLine('Beste Streak',k.bestStreak)}</div><div style="margin-top:12px"><div class="small-note">Fortschritt</div><div class="progress"><div class="progress-bar" style="width:${Math.round((k.learned.length/46)*100)}%"></div></div></div></div>
    </div>
    <div class="card"><div class="title" style="font-size:1.2rem">Häufige Hiragana-Fehler</div><div class="list">${mistakes.length ? mistakes.map(([char,count]) => `<div class="list-item"><span style="font-size:1.6rem">${char}</span><span class="badge">${count}x falsch</span></div>`).join('') : `<div class="subtitle">Noch keine Fehler gespeichert.</div>`}</div></div>
  `,'home');
}
function renderDaily(){
  const script = state.lastSelection.script || 'hiragana';
  const cfg = scripts[script];
  const key = getTodayKey();
  if(!state.daily[key]){ state.daily[key] = { script, set: buildDailySet(cfg.items).map(i=>i.char), index:0, correct:0, done:false }; persist(); }
  const daily = state.daily[key];
  const current = cfg.items.find(i => i.char === daily.set[daily.index]) || cfg.items[0];
  const options = current ? shuffle([current.romaji, ...shuffle(cfg.items.filter(i=>i.romaji!==current.romaji)).slice(0,3).map(i=>i.romaji)]) : [];
  renderShell('Daily Challenge', `Heute: ${daily.index}/20 · ${cfg.label}`, `
    <div class="card"><div class="row"><button class="chip ${script==='hiragana'?'active':''}" data-action="daily-script:hiragana">Hiragana</button><button class="chip ${script==='katakana'?'active':''}" data-action="daily-script:katakana">Katakana</button></div></div>
    <div class="card question-card">${daily.done ? `<div class="title" style="font-size:1.3rem">Heute geschafft</div><div class="big-kana" style="font-size:3rem">${daily.correct} / 20</div><div class="subtitle">Morgen gibt es eine neue Challenge.</div>` : `<div class="prompt">Welches Romaji passt zu diesem Zeichen?</div><div class="big-kana">${current.char}</div><div class="answers">${options.map(opt=>`<button class="answer-btn" data-action="daily-answer:${opt}">${opt}</button>`).join('')}</div><div id="result" class="result"></div>`}</div>
  `,'home');
}
function renderSettings(){
  renderShell('Einstellungen','Kurze Hinweise und Datenverwaltung.',`
    <div class="card"><div class="title" style="font-size:1.2rem">Hinweise</div><div class="list"><div class="list-item"><span>Offline-Nutzung</span><span class="badge">PWA</span></div><div class="list-item"><span>Fortschritt</span><span class="badge">lokal gespeichert</span></div><div class="list-item"><span>iPhone</span><span class="badge">Safari → Zum Home-Bildschirm</span></div></div></div>
    <div class="card"><div class="title" style="font-size:1.2rem">Daten</div><div class="footer-actions"><button class="small-btn danger" data-action="reset-all">Fortschritt komplett löschen</button></div></div>
  `,'home');
}
function render(){ const { name, params } = currentRoute; if(name==='home') renderHome(); else if(name==='script') renderScript(params.script); else if(name==='trainer') renderTrainer(params.script, params.mode); else if(name==='stats') renderStats(); else if(name==='daily') renderDaily(); else if(name==='settings') renderSettings(); }
window.addEventListener('routechange', render);
function bindActions(){
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click', e=>handleAction(e.currentTarget.dataset.action)));
  document.querySelectorAll('[data-answer]').forEach(el=>el.addEventListener('click', e=>handleAnswer(e.currentTarget.dataset.answer)));
}
function handleAction(action){
  if(action.startsWith('back:')){ const raw = action.split(':')[1]; if(raw==='home') return go('home'); if(raw.startsWith('script-')) return go('script',{script:raw.split('-')[1]}); }
  if(action.startsWith('script:')) return go('script',{script:action.split(':')[1]});
  if(action.startsWith('trainer:')){ const [,script,mode] = action.split(':'); return go('trainer',{script,mode}); }
  if(action==='stats') return go('stats');
  if(action==='daily') return go('daily');
  if(action==='settings') return go('settings');
  if(action.startsWith('difficulty:')){ state.lastSelection.difficulty = action.split(':')[1]; persist(); return go('trainer',{...currentMode}); }
  if(action.startsWith('row:')){ state.lastSelection.row = action.split(':')[1]; persist(); return go('trainer',{...currentMode}); }
  if(action.startsWith('writeDir:')){ state.lastSelection.writeDir = action.split(':')[1]; persist(); return go('trainer',{...currentMode}); }
  if(action==='next') return go('trainer',{...currentMode});
  if(action==='check-writing') return handleWritingCheck();
  if(action==='check-word') return handleWordCheck();
  if(action==='clear-canvas') return clearCanvas();
  if(action==='toggle-ghost'){ const g=document.getElementById('ghostKana'); if(g) g.style.display = g.style.display==='none' ? 'flex' : 'none'; return; }
  if(action==='mark-drawn'){ const bucket=state.progress[currentMode.script]; if(!bucket.learned.includes(currentRound.current.char)) bucket.learned.push(currentRound.current.char); persist(); const r=document.getElementById('result'); if(r) r.textContent='✅ Als geübt markiert'; return; }
  if(action==='reset-all'){ localStorage.clear(); location.reload(); return; }
  if(action.startsWith('daily-script:')){ delete state.daily[getTodayKey()]; state.lastSelection.script = action.split(':')[1]; persist(); return go('daily'); }
  if(action.startsWith('daily-answer:')) return handleDailyAnswer(action.split(':')[1]);
}
function handleAnswer(answer){
  if(!currentRound || !currentMode) return;
  let correct = false;
  if(['classic','alphabet','rows','mistakes','extended'].includes(currentMode.mode)) correct = answer === currentRound.current.romaji;
  else if(['reverse','confusion'].includes(currentMode.mode)) correct = answer === currentRound.current.char;
  registerResult(state,currentMode.script,currentRound.current,correct); persist();
  const result=document.getElementById('result');
  if(result) result.textContent = correct ? '✅ Richtig' : `❌ Falsch – ${['reverse','confusion'].includes(currentMode.mode) ? currentRound.current.char : currentRound.current.romaji}`;
}
function handleWritingCheck(){
  const value=(document.getElementById('writeInput')?.value || '').trim().toLowerCase(); if(!value || !currentRound) return;
  const correctValue = currentRound.direction==='kana-to-romaji' ? currentRound.current.romaji : currentRound.current.char;
  const ok = value === correctValue.toLowerCase(); registerResult(state,currentMode.script,currentRound.current,ok); persist();
  const result=document.getElementById('result'); if(result) result.textContent = ok ? '✅ Richtig' : `❌ Falsch – ${correctValue}`;
}
function handleWordCheck(){
  const value=(document.getElementById('writeInput')?.value || '').trim().toLowerCase(); if(!value || !currentRound) return;
  const ok = value === currentRound.current.romaji.toLowerCase(); registerResult(state,currentMode.script,{char:currentRound.current.word},ok); persist();
  const result=document.getElementById('result'); if(result) result.textContent = ok ? '✅ Richtig' : `❌ Falsch – ${currentRound.current.romaji}`;
}
function handleDailyAnswer(answer){
  const key=getTodayKey(), daily=state.daily[key], cfg=scripts[daily.script], current=cfg.items.find(i=>i.char===daily.set[daily.index]); const ok = answer===current.romaji; if(ok) daily.correct++; daily.index++; if(daily.index>=20) daily.done=true; state.daily[key]=daily; registerResult(state,daily.script,current,ok); persist(); const result=document.getElementById('result'); if(result) result.textContent = ok ? '✅ Richtig' : `❌ Falsch – ${current.romaji}`; setTimeout(()=>go('daily'),350);
}
let drawing=false,last=null;
function initCanvas(){
  const canvas=document.getElementById('drawCanvas'); if(!canvas) return; clearCanvas();
  const ctx = canvas.getContext('2d');
  const getPos = (e) => { const rect=canvas.getBoundingClientRect(); const s=e.touches?e.touches[0]:e; return {x:(s.clientX-rect.left)*(canvas.width/rect.width),y:(s.clientY-rect.top)*(canvas.height/rect.height)}; };
  const start = (e) => { drawing=true; last=getPos(e); };
  const move = (e) => { if(!drawing) return; if(e.preventDefault) e.preventDefault(); const p=getPos(e); ctx.strokeStyle='#111'; ctx.lineWidth=12; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; };
  const end = () => { drawing=false; last=null; };
  canvas.onpointerdown=start; canvas.onpointermove=move; canvas.onpointerup=end; canvas.onpointerleave=end; canvas.ontouchstart=start; canvas.ontouchmove=move; canvas.ontouchend=end;
}
function clearCanvas(){
  const canvas=document.getElementById('drawCanvas'); if(!canvas) return; const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.strokeStyle='#e6e6e6'; ctx.lineWidth=1; for(let i=50;i<canvas.width;i+=50){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,canvas.height);ctx.stroke()} for(let i=50;i<canvas.height;i+=50){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(canvas.width,i);ctx.stroke()}
}
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
go('home');