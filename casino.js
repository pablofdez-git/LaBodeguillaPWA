// casino.js — Casino La Bodeguilla (PWA)
import { registrarOObtenerJugador, sincronizarJugador, getRanking } from './supabase.js';

// ── Constantes ────────────────────────────────────────────────────────────────
const SIMBOLOS_SLOTS = ['🍺','🍷','🥩','💵','💎','🃏','🔊','🧊','🥪'];
const SIMBOLOS_RASCA = ['🍺','🍷','🥩','💎','💵','🃏','🎯','🍋','🔔'];
const NUMEROS_RULETA = [
  {n:0,c:'verde'},{n:1,c:'rojo'},{n:2,c:'negro'},{n:3,c:'rojo'},{n:4,c:'negro'},
  {n:5,c:'rojo'},{n:6,c:'negro'},{n:7,c:'rojo'},{n:8,c:'negro'},{n:9,c:'rojo'},
  {n:10,c:'negro'},{n:11,c:'negro'},{n:12,c:'rojo'},{n:13,c:'negro'},{n:14,c:'rojo'},
  {n:15,c:'rojo'},{n:16,c:'negro'},{n:17,c:'rojo'},{n:18,c:'negro'},{n:19,c:'rojo'},
  {n:20,c:'negro'},{n:21,c:'rojo'},{n:22,c:'negro'},{n:23,c:'rojo'},{n:24,c:'negro'},
  {n:25,c:'rojo'},{n:26,c:'negro'},{n:27,c:'rojo'},{n:28,c:'negro'},{n:29,c:'negro'},
  {n:30,c:'rojo'},{n:31,c:'negro'},{n:32,c:'rojo'},{n:33,c:'negro'},{n:34,c:'rojo'},
  {n:35,c:'negro'},{n:36,c:'rojo'},
];
const BARAJA_WAR = (() => {
  const palos = ['♠','♥','♦','♣'];
  const figuras = [
    {n:'2',v:2},{n:'3',v:3},{n:'4',v:4},{n:'5',v:5},{n:'6',v:6},{n:'7',v:7},
    {n:'8',v:8},{n:'9',v:9},{n:'10',v:10},{n:'J',v:11},{n:'Q',v:12},{n:'K',v:13},{n:'A',v:14},
  ];
  const m = [];
  for (const p of palos) for (const f of figuras) m.push({...f, palo:p});
  return m;
})();

// ── Estado ────────────────────────────────────────────────────────────────────
let nombreJugador = '';
let monedas       = 500;
let bancarrotas   = 0;
let pantallaC     = 'cargando'; // cargando|registro|lobby|blackjack|ruleta|slots|dados|rasca|war|ranking
let modalAyuda    = null;

// Blackjack — estado completo (espejo de la APK)
let bjZapato=[], bjManoJ=[], bjManoSplit=[], bjManoC=[];
let bjApuesta=50, bjApuestaDoble=0;
let bjFase='lobby'; // lobby|jugando|seguro|split2|resultado
let bjJugandoSplit=false;
let bjResultado='', bjMensaje='', bjResultadoSplit='', bjMensajeSplit='';
let bjPuedeDoble=false, bjPuedeSplit=false, bjOfrecerSeguro=false, bjSeguroPagado=false;
let bjVerTapete=false;
let rachaActual=0, rachaMaxima=0;

// Ruleta
let fichasRuleta={}, fichaSeleccionada=5, girandoRuleta=false, resultadoRuleta=null;

// Slots
let slotsValores=['🍺','🍷','🥩'], girandoSlots=false, apuestaSlots=20, mensajeSlots='';

// Dados
let apuestaDados=20, dadosValores=[null,null], dadosTirandose=false, dadosPunto=null, dadosFase='inicio', dadosMensaje='';

// Rasca
let rascaApuesta=20, rascaCasillas=[], rascaFase='comprar', rascaMensaje='', rascaResultado='';
let rascaTiradasHoy=0;
const RASCA_LIMITE_DIARIO=5;

// War
let warApuesta=20, warCartaJ=null, warCartaC=null, warCartasGuerra=null, warFase='inicio', warMensaje='', warResultado='', warAnimando=false;

// Ranking
let rankingData=[];

// ── Helpers ───────────────────────────────────────────────────────────────────
const guardarLocal = (k,v) => localStorage.setItem(k, String(v));
const leerLocal    = (k,d) => localStorage.getItem(k) ?? d;
const cartaAleatoria = () => BARAJA_WAR[Math.floor(Math.random()*BARAJA_WAR.length)];

function verificarBancarrota() {
  if (monedas <= 0) {
    bancarrotas++;
    monedas = 50;
    guardarLocal('@bj_monedas', monedas);
    guardarLocal('@casino_bancarrotas', bancarrotas);
    sincronizarJugador({nombre:nombreJugador, monedas, bancarrotas}).catch(()=>{});
    alert(`💸 Bancarrota #${bancarrotas}. Se te dan 50 monedas para reengancharte.`);
    return true;
  }
  return false;
}
function guardarMonedas() {
  guardarLocal('@bj_monedas', monedas);
  sincronizarJugador({nombre:nombreJugador, monedas, bancarrotas}).catch(()=>{});
}

// ── Blackjack — Lógica completa (zapato 4 barajas, split, doble, seguro, 3:2) ──
function crearZapato(){
  const palos=['♦','♣','♥','♠'];
  const vals=[
    {nombre:'A',valor:11},{nombre:'2',valor:2},{nombre:'3',valor:3},{nombre:'4',valor:4},
    {nombre:'5',valor:5},{nombre:'6',valor:6},{nombre:'7',valor:7},{nombre:'8',valor:8},
    {nombre:'9',valor:9},{nombre:'10',valor:10},{nombre:'J',valor:10},{nombre:'Q',valor:10},{nombre:'K',valor:10},
  ];
  let z=[];
  for(let d=0;d<4;d++) for(const p of palos) for(const v of vals) z.push({...v,palo:p});
  for(let i=z.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[z[i],z[j]]=[z[j],z[i]];}
  return z;
}
function calcularMano(mano){
  let pts=mano.reduce((t,c)=>t+c.valor,0), ases=mano.filter(c=>c.nombre==='A').length;
  while(pts>21&&ases>0){pts-=10;ases--;}
  return pts;
}
function esBJNatural(mano){ return mano.length===2&&calcularMano(mano)===21; }

function resolverPagoBJ(res, apuesta, esNatural=false){
  if(res==='ganado'){
    const g=esNatural?Math.floor(apuesta*1.5):apuesta;
    rachaActual++; guardarLocal('@bj_racha',rachaActual);
    if(rachaActual>rachaMaxima){rachaMaxima=rachaActual;guardarLocal('@bj_racha_max',rachaMaxima);}
    return g;
  } else if(res==='perdido'){
    rachaActual=0; guardarLocal('@bj_racha',0);
    return -apuesta;
  }
  return 0; // empate
}

function finalizarManoBJ(mJ, mC, apuesta, esNat=false){
  const pJ=calcularMano(mJ), pC=calcularMano(mC);
  let res='', msg='';
  if(pJ>21){res='perdido';msg='Te has pasado de 21. Gana la casa.';}
  else if(pC>21){res='ganado';msg='El crupier se pasa. ¡Victoria!';}
  else if(esNat&&!esBJNatural(mC)){res='ganado';msg='¡BLACKJACK NATURAL! Cobras 3:2.';}
  else if(pJ>pC){res='ganado';msg='Mayor puntuación. ¡Has ganado!';}
  else if(pC>pJ){res='perdido';msg='El crupier tiene mejor mano. Gana la casa.';}
  else{res='empate';msg='Empate. Se devuelve la apuesta.';}
  return {res,msg};
}

function iniciarBJ(){
  if(monedas<bjApuesta){alert('No tienes suficientes monedas.');return;}
  const saldoResta=monedas-bjApuesta;
  monedas=saldoResta;
  bjVerTapete=true; bjFase='jugando'; bjResultado=''; bjResultadoSplit='';
  bjMensaje=''; bjMensajeSplit=''; bjManoSplit=[]; bjJugandoSplit=false;
  bjApuestaDoble=0; bjOfrecerSeguro=false; bjSeguroPagado=false;
  bjPuedeDoble=false; bjPuedeSplit=false;
  const z=crearZapato();
  const cJ1=z.pop(),cC1=z.pop(),cJ2=z.pop(),cC2=z.pop();
  bjManoJ=[cJ1,cJ2]; bjManoC=[cC1,cC2]; bjZapato=z;
  render();
  const bjJ=esBJNatural(bjManoJ), bjC=esBJNatural(bjManoC);
  // Ofrecer seguro si carta visible crupier es As
  if(cC1.nombre==='A'&&!bjJ){
    bjOfrecerSeguro=true; bjFase='seguro';
    bjPuedeDoble=false; bjPuedeSplit=false;
    render(); return;
  }
  // BJ natural
  if(bjJ||bjC){
    bjFase='resultado';
    if(bjJ&&bjC){
      bjResultado='empate'; bjMensaje='Doble Blackjack Natural. Empate.';
      monedas=saldoResta+bjApuesta;
    } else if(bjJ){
      const g=resolverPagoBJ('ganado',bjApuesta,true);
      monedas=saldoResta+bjApuesta+g;
      bjResultado='ganado'; bjMensaje=`¡BLACKJACK! Ganas ${bjApuesta+g} monedas (3:2).`;
    } else {
      resolverPagoBJ('perdido',bjApuesta);
      bjResultado='perdido'; bjMensaje='Blackjack del crupier. Gana la casa.';
    }
    guardarMonedas(); verificarBancarrota(); render(); return;
  }
  // Partida normal
  bjPuedeDoble=true;
  bjPuedeSplit=bjManoJ[0].valor===bjManoJ[1].valor;
  render();
}

function bjRechazarSeguro(){
  bjOfrecerSeguro=false; bjFase='jugando';
  bjPuedeDoble=true;
  bjPuedeSplit=bjManoJ.length===2&&bjManoJ[0].valor===bjManoJ[1].valor;
  render();
}

function bjAceptarSeguro(){
  const coste=Math.floor(bjApuesta/2);
  if(monedas<coste){alert('No tienes monedas para el seguro.');return;}
  monedas-=coste; guardarMonedas();
  if(esBJNatural(bjManoC)){
    const cobro=coste*2; monedas+=cobro;
    bjOfrecerSeguro=false; bjFase='resultado';
    bjResultado='perdido'; bjMensaje=`Blackjack del crupier. Seguro cobrado: +${cobro} monedas.`;
    guardarMonedas(); verificarBancarrota(); render();
  } else {
    bjSeguroPagado=true; bjOfrecerSeguro=false; bjFase='jugando';
    bjPuedeDoble=true;
    bjPuedeSplit=bjManoJ.length===2&&bjManoJ[0].valor===bjManoJ[1].valor;
    render();
  }
}

function bjPedir(){
  if(bjFase!=='jugando'&&bjFase!=='split2')return;
  const z=[...bjZapato], carta=z.pop(); bjZapato=z;
  bjPuedeDoble=false; bjPuedeSplit=false;
  if(bjJugandoSplit){
    bjManoSplit=[...bjManoSplit,carta];
    if(calcularMano(bjManoSplit)>21){
      bjResultadoSplit='perdido'; bjMensajeSplit='Te pasaste en la segunda mano.';
      bjTurnoCrupier(z,[...bjManoC],bjManoJ,bjManoSplit,monedas,0);
    } else render();
  } else {
    bjManoJ=[...bjManoJ,carta];
    if(calcularMano(bjManoJ)>21){
      if(bjManoSplit.length>0){
        bjResultado='perdido'; bjMensaje='Te pasaste en la primera mano.';
        bjJugandoSplit=true; bjFase='split2'; render();
      } else {
        bjFase='resultado'; bjResultado='perdido'; bjMensaje='Te has pasado de 21.';
        resolverPagoBJ('perdido',bjApuesta);
        guardarMonedas(); verificarBancarrota(); render();
      }
    } else render();
  }
}

function bjPlantar(){
  if(bjFase!=='jugando'&&bjFase!=='split2')return;
  bjPuedeDoble=false; bjPuedeSplit=false;
  if(!bjJugandoSplit&&bjManoSplit.length>0){
    bjJugandoSplit=true; bjFase='split2'; render(); return;
  }
  const manoFinal=bjJugandoSplit?bjManoSplit:bjManoJ;
  bjTurnoCrupier([...bjZapato],[...bjManoC],bjJugandoSplit?bjManoJ:manoFinal,bjJugandoSplit?manoFinal:[],monedas,bjApuestaDoble);
}

function bjDoblar(){
  if(!bjPuedeDoble)return;
  if(monedas<bjApuesta){alert('No tienes monedas para doblar.');return;}
  monedas-=bjApuesta; bjApuestaDoble=bjApuesta;
  bjPuedeDoble=false; bjPuedeSplit=false;
  const z=[...bjZapato], carta=z.pop(); bjZapato=z;
  bjManoJ=[...bjManoJ,carta]; render();
  setTimeout(()=>{
    if(calcularMano(bjManoJ)>21){
      bjFase='resultado'; bjResultado='perdido'; bjMensaje='Doble — te has pasado.';
      guardarMonedas(); verificarBancarrota(); render();
    } else {
      bjTurnoCrupier(z,[...bjManoC],bjManoJ,[],monedas,bjApuestaDoble);
    }
  },300);
}

function bjSplit(){
  if(!bjPuedeSplit)return;
  if(monedas<bjApuesta){alert('No tienes monedas para el split.');return;}
  monedas-=bjApuesta; guardarMonedas();
  const z=[...bjZapato];
  const mano1=[bjManoJ[0],z.pop()], mano2=[bjManoJ[1],z.pop()];
  bjManoJ=mano1; bjManoSplit=mano2; bjZapato=z;
  bjPuedeDoble=false; bjPuedeSplit=false;
  if(bjManoJ[0].nombre==='A'){
    // Split de Ases: una carta por mano, resolver directo
    bjFase='resultado';
    setTimeout(()=>bjTurnoCrupier(z,[...bjManoC],mano1,mano2,monedas,0),400);
  } else {
    bjJugandoSplit=false; bjFase='jugando'; render();
  }
}

function bjRendirse(){
  if(!bjPuedeDoble)return; // solo con 2 cartas iniciales
  const devuelto=Math.floor(bjApuesta/2);
  monedas+=devuelto;
  bjFase='resultado'; bjResultado='perdido';
  bjMensaje=`Te rindes. Recuperas ${devuelto} monedas.`;
  guardarMonedas(); render();
}

function bjTurnoCrupier(zapato, manoC, mJ1, mJ2, saldoBase, dobleExtra){
  const turno=()=>{
    const pC=calcularMano(manoC);
    if(pC<17){
      manoC.push(zapato.pop()); bjManoC=[...manoC]; bjZapato=[...zapato]; render();
      setTimeout(turno,550);
    } else {
      const {res:r1,msg:m1}=finalizarManoBJ(mJ1,manoC,bjApuesta);
      bjResultado=r1; bjMensaje=m1;
      let saldoFinal=saldoBase;
      if(r1==='ganado') saldoFinal+=bjApuesta*2;
      else if(r1==='empate') saldoFinal+=bjApuesta;
      if(dobleExtra>0){
        if(r1==='ganado') saldoFinal+=dobleExtra*2;
        else if(r1==='empate') saldoFinal+=dobleExtra;
      }
      if(mJ2&&mJ2.length>0){
        const {res:r2,msg:m2}=finalizarManoBJ(mJ2,manoC,bjApuesta);
        bjResultadoSplit=r2; bjMensajeSplit=m2;
        if(r2==='ganado') saldoFinal+=bjApuesta*2;
        else if(r2==='empate') saldoFinal+=bjApuesta;
      }
      monedas=saldoFinal;
      // Racha
      if(r1==='ganado'){
        rachaActual++; guardarLocal('@bj_racha',rachaActual);
        if(rachaActual>rachaMaxima){rachaMaxima=rachaActual;guardarLocal('@bj_racha_max',rachaMaxima);}
      } else if(r1==='perdido'){ rachaActual=0; guardarLocal('@bj_racha',0); }
      bjFase='resultado';
      guardarMonedas(); verificarBancarrota(); render();
    }
  };
  turno();
}

// ── Ruleta ────────────────────────────────────────────────────────────────────
function apostarRuleta(tipo, valor){
  if(girandoRuleta)return;
  const coste=fichaSeleccionada;
  if(monedas<coste){alert('No tienes monedas suficientes.');return;}
  const k=`${tipo}_${valor}`;
  fichasRuleta[k]=(fichasRuleta[k]||0)+coste;
  monedas-=coste;
  guardarMonedas(); render();
}
function limpiarRuleta(){ fichasRuleta={}; guardarMonedas(); render(); }
async function girarRuleta(){
  if(girandoRuleta||Object.keys(fichasRuleta).length===0){alert('Coloca al menos una ficha.');return;}
  girandoRuleta=true; render();
  await new Promise(r=>setTimeout(r,1200));
  const idx=Math.floor(Math.random()*NUMEROS_RULETA.length);
  const resultado=NUMEROS_RULETA[idx];
  resultadoRuleta=resultado;
  let ganancia=0;
  for(const [k,apuesta] of Object.entries(fichasRuleta)){
    const [tipo,val]=k.split('_');
    if(tipo==='numero'&&parseInt(val)===resultado.n) ganancia+=apuesta*36;
    else if(tipo==='color'&&val===resultado.c&&resultado.n!==0) ganancia+=apuesta*2;
    else if(tipo==='paridad'){
      const par=resultado.n%2===0&&resultado.n!==0;
      if((val==='par'&&par)||(val==='impar'&&!par&&resultado.n!==0)) ganancia+=apuesta*2;
    }
  }
  monedas+=ganancia;
  fichasRuleta={};
  girandoRuleta=false;
  guardarMonedas();
  verificarBancarrota();
  render();
  setTimeout(()=>alert(ganancia>0?`🎯 Salió el ${resultado.n}. ¡Ganas ${ganancia} monedas!`:`😬 Salió el ${resultado.n}. Sin premio.`),50);
}

// ── Slots ─────────────────────────────────────────────────────────────────────
async function jugarSlots(){
  if(girandoSlots)return;
  if(monedas<apuestaSlots){alert('No tienes monedas suficientes.');return;}
  monedas-=apuestaSlots; girandoSlots=true; mensajeSlots=''; render();
  let ticks=0;
  await new Promise(res=>{
    const iv=setInterval(()=>{
      slotsValores=[
        SIMBOLOS_SLOTS[Math.floor(Math.random()*SIMBOLOS_SLOTS.length)],
        SIMBOLOS_SLOTS[Math.floor(Math.random()*SIMBOLOS_SLOTS.length)],
        SIMBOLOS_SLOTS[Math.floor(Math.random()*SIMBOLOS_SLOTS.length)],
      ];
      ticks++; render();
      if(ticks>=12){clearInterval(iv);res();}
    },80);
  });
  const conteo={};
  slotsValores.forEach(s=>conteo[s]=(conteo[s]||0)+1);
  const max=Math.max(...Object.values(conteo));
  const sim=Object.keys(conteo).find(k=>conteo[k]===max);
  let premio=0;
  if(max===3){
    const mult=sim==='💎'?60:sim==='💵'?40:sim==='🥩'?25:15;
    premio=apuestaSlots*mult;
    mensajeSlots=`🎉 ¡TRIFECTA! ${sim}×3 — +${premio} monedas`;
  } else if(max===2){
    premio=apuestaSlots*3;
    mensajeSlots=`✨ Par de ${sim} — +${premio} monedas`;
  } else {
    mensajeSlots='❌ Sin premio. ¡Dale otra vez!';
  }
  monedas+=premio;
  girandoSlots=false;
  guardarMonedas();
  verificarBancarrota();
  render();
}

// ── Dados ─────────────────────────────────────────────────────────────────────
async function tirarDados(){
  if(dadosTirandose)return;
  if(dadosFase==='inicio'&&monedas<apuestaDados){alert('No tienes monedas suficientes.');return;}
  let saldoBase=monedas;
  if(dadosFase==='inicio'){saldoBase=monedas-apuestaDados; monedas=saldoBase;}
  dadosTirandose=true; dadosMensaje=''; render();
  let ticks=0;
  await new Promise(res=>{
    const iv=setInterval(()=>{
      dadosValores=[Math.ceil(Math.random()*6),Math.ceil(Math.random()*6)];
      ticks++; render();
      if(ticks>=10){clearInterval(iv);res();}
    },80);
  });
  const d1=Math.ceil(Math.random()*6), d2=Math.ceil(Math.random()*6), suma=d1+d2;
  dadosValores=[d1,d2]; dadosTirandose=false;
  if(dadosFase==='inicio'){
    if(suma===7||suma===11){
      monedas=saldoBase+apuestaDados*2;
      dadosMensaje=`🎲 ¡${suma}! Victoria natural. +${apuestaDados*2} monedas`;
      dadosFase='inicio'; dadosPunto=null;
    } else if([2,3,12].includes(suma)){
      dadosMensaje=`💀 ¡Craps! ${suma} — la casa gana.`;
      dadosFase='inicio'; dadosPunto=null;
    } else {
      dadosPunto=suma; dadosFase='punto';
      dadosMensaje=`🎯 Punto: ${suma}. ¡Sácalo antes que el 7!`;
    }
  } else {
    if(suma===dadosPunto){
      monedas=saldoBase+apuestaDados*2;
      dadosMensaje=`🏆 ¡${suma}! Punto conseguido. +${apuestaDados*2} monedas`;
      dadosFase='inicio'; dadosPunto=null;
    } else if(suma===7){
      dadosMensaje=`💀 ¡7! La casa gana.`;
      dadosFase='inicio'; dadosPunto=null;
    } else {
      dadosMensaje=`🎲 ${suma}. Punto sigue siendo ${dadosPunto}, sigue tirando.`;
    }
  }
  guardarMonedas(); verificarBancarrota(); render();
}

// ── Rasca ─────────────────────────────────────────────────────────────────────
function cargarLimiteRasca(){
  const hoy=new Date().toISOString().slice(0,10);
  const dia=leerLocal('@rasca_dia','');
  if(dia===hoy){ rascaTiradasHoy=parseInt(leerLocal('@rasca_count','0')); }
  else { rascaTiradasHoy=0; guardarLocal('@rasca_dia',hoy); guardarLocal('@rasca_count','0'); }
}
function comprarRasca(){
  cargarLimiteRasca();
  if(rascaTiradasHoy>=RASCA_LIMITE_DIARIO){ alert(`Límite diario alcanzado (${RASCA_LIMITE_DIARIO} cartones). Vuelve mañana.`); return; }
  if(monedas<rascaApuesta){alert('No tienes monedas suficientes.');return;}
  rascaTiradasHoy++;
  guardarLocal('@rasca_count', rascaTiradasHoy);
  guardarLocal('@rasca_dia', new Date().toISOString().slice(0,10));
  monedas-=rascaApuesta;
  const rand=Math.random();
  let simbolos;
  if(rand<0.08){
    const g=SIMBOLOS_RASCA[Math.floor(Math.random()*SIMBOLOS_RASCA.length)];
    const r=[...SIMBOLOS_RASCA.filter(s=>s!==g)].sort(()=>Math.random()-.5);
    simbolos=[g,g,g,r[0],r[1],r[2]];
  } else if(rand<0.43){
    const g=SIMBOLOS_RASCA[Math.floor(Math.random()*SIMBOLOS_RASCA.length)];
    const r=[...SIMBOLOS_RASCA.filter(s=>s!==g)].sort(()=>Math.random()-.5);
    simbolos=[g,g,r[0],r[1],r[2],r[3]];
  } else {
    simbolos=[...SIMBOLOS_RASCA].sort(()=>Math.random()-.5).slice(0,6);
  }
  for(let i=simbolos.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[simbolos[i],simbolos[j]]=[simbolos[j],simbolos[i]];}
  rascaCasillas=simbolos.map(s=>({simbolo:s,revelada:false}));
  rascaFase='rascando'; rascaMensaje='Toca cada casilla para rascar...'; rascaResultado='';
  guardarMonedas(); render();
}
function rascarCasilla(idx){
  if(rascaFase!=='rascando')return;
  rascaCasillas[idx].revelada=true;
  if(rascaCasillas.every(c=>c.revelada)) calcularRasca();
  else render();
}
function revelarTodoRasca(){
  rascaCasillas.forEach(c=>c.revelada=true);
  calcularRasca();
}
function calcularRasca(){
  const conteo={};
  rascaCasillas.forEach(c=>conteo[c.simbolo]=(conteo[c.simbolo]||0)+1);
  const max=Math.max(...Object.values(conteo));
  const sim=Object.keys(conteo).find(k=>conteo[k]===max);
  let premio=0;
  if(max>=3){
    const mult=sim==='💎'?80:sim==='💵'?40:20;
    premio=rascaApuesta*mult;
    rascaMensaje=`🎉 ¡TRIFECTA! ${sim}×3 — +${premio} monedas`;
    rascaResultado='ganado';
  } else if(max===2){
    premio=rascaApuesta*4;
    rascaMensaje=`✨ Par de ${sim} — +${premio} monedas`;
    rascaResultado='ganado';
  } else {
    rascaMensaje='❌ Sin premio. ¡Prueba otro cartón!';
    rascaResultado='perdido';
  }
  monedas+=premio; rascaFase='fin';
  guardarMonedas(); verificarBancarrota(); render();
}

// ── War ───────────────────────────────────────────────────────────────────────
async function jugarWar(){
  if(monedas<warApuesta){alert('No tienes monedas suficientes.');return;}
  monedas-=warApuesta; warAnimando=true; warMensaje=''; warCartasGuerra=null; render();
  await new Promise(r=>setTimeout(r,600));
  const cJ=cartaAleatoria(), cC=cartaAleatoria();
  warCartaJ=cJ; warCartaC=cC; warAnimando=false;
  if(cJ.v>cC.v){
    monedas+=warApuesta*2;
    warMensaje=`🏆 ¡Ganas! ${cJ.n}${cJ.palo} > ${cC.n}${cC.palo} · +${warApuesta*2} monedas`;
    warResultado='ganado'; warFase='fin';
  } else if(cJ.v<cC.v){
    warMensaje=`💀 Pierdes. ${cJ.n}${cJ.palo} < ${cC.n}${cC.palo}`;
    warResultado='perdido'; warFase='fin';
  } else {
    warMensaje=`⚔️ ¡EMPATE! Ambos con ${cJ.n}. ¿Vas a la guerra?`;
    warResultado='empate'; warFase='empate';
  }
  guardarMonedas(); verificarBancarrota(); render();
}
async function irAGuerraWar(){
  if(monedas<warApuesta){alert('No tienes monedas para doblar.');return;}
  monedas-=warApuesta; warAnimando=true; warMensaje=''; render();
  await new Promise(r=>setTimeout(r,700));
  const cJ=cartaAleatoria(), cC=cartaAleatoria();
  warCartasGuerra={j:cJ,c:cC}; warAnimando=false;
  if(cJ.v>=cC.v){
    monedas+=warApuesta*4;
    warMensaje=`🔥 ¡GUERRA GANADA! ${cJ.n}${cJ.palo} vs ${cC.n}${cC.palo} · +${warApuesta*4} monedas`;
    warResultado='ganado';
  } else {
    warMensaje=`💀 Guerra perdida. ${cJ.n}${cJ.palo} < ${cC.n}${cC.palo}`;
    warResultado='perdido';
  }
  warFase='fin'; guardarMonedas(); verificarBancarrota(); render();
}
function rendirseWar(){
  const rec=Math.floor(warApuesta/2);
  monedas+=rec;
  warMensaje=`🏳️ Te rindes. Recuperas ${rec} monedas.`;
  warResultado='perdido'; warFase='fin';
  guardarMonedas(); render();
}

// ── Registro ──────────────────────────────────────────────────────────────────
async function confirmarNombre(nombre){
  nombre=nombre.trim();
  if(!nombre){alert('Escribe tu nombre.');return;}
  if(nombre.length<2||nombre.length>20){alert('Entre 2 y 20 caracteres.');return;}
  const {ok,jugador,error}=await registrarOObtenerJugador(nombre);
  if(!ok){alert('Error de conexión: '+error);return;}
  nombreJugador=nombre;
  monedas=jugador.monedas??500;
  bancarrotas=jugador.bancarrotas??0;
  guardarLocal('@casino_nombre',nombre);
  guardarLocal('@bj_monedas',monedas);
  guardarLocal('@casino_bancarrotas',bancarrotas);
  pantallaC='lobby'; render();
}

// ── Ranking ───────────────────────────────────────────────────────────────────
async function cargarRanking(){
  rankingData=await getRanking();
  pantallaC='ranking'; render();
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function colCarta(palo){ return ['♥','♦'].includes(palo)?'#C94A3F':'#111111'; }

function htmlCarta(c, oculta=false){
  if(oculta) return `<div style="width:56px;height:84px;border-radius:8px;background:#2E1065;border:2px solid rgba(196,181,253,.5);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0"><img src="assets/Javicristo.png" style="width:100%;height:100%;object-fit:cover"/></div>`;
  const color=colCarta(c.palo);
  return `<div style="width:56px;height:84px;border-radius:8px;background:#fff;border:1px solid #D1D5DB;padding:5px;display:flex;flex-direction:column;justify-content:space-between;flex-shrink:0;box-shadow:0 3px 6px rgba(0,0,0,.3)">
    <div style="font-size:13px;font-weight:900;color:${color};line-height:1">${c.figura||c.n}<br><span style="font-size:11px">${c.palo}</span></div>
    <div style="font-size:22px;text-align:center;color:${color}">${c.palo}</div>
  </div>`;
}

function htmlDado(val, animando=false){
  const puntos={1:[[50,50]],2:[[25,25],[75,75]],3:[[25,25],[50,50],[75,75]],4:[[25,25],[75,25],[25,75],[75,75]],5:[[25,25],[75,25],[50,50],[25,75],[75,75]],6:[[25,22],[75,22],[25,50],[75,50],[25,78],[75,78]]};
  const size=80;
  const pts=val?puntos[val]:[];
  const bg=animando?'#fff':'#F8F5FF';
  const border=animando?'#F87171':'rgba(248,113,113,.5)';
  const dotsHtml=val===null
    ? `<span style="color:#C4B5FD;font-size:28px;font-weight:900">?</span>`
    : pts.map(p=>`<div style="position:absolute;width:${size*.16}px;height:${size*.16}px;border-radius:50%;background:#1C1130;left:${(p[0]/100)*size-(size*.08)}px;top:${(p[1]/100)*size-(size*.08)}px"></div>`).join('');
  return `<div style="position:relative;width:${size}px;height:${size}px;background:${bg};border-radius:14px;border:2.5px solid ${border};display:flex;align-items:center;justify-content:center">${dotsHtml}</div>`;
}

function btnAyuda(juego){ return `<button onclick="window._casinoAyuda('${juego}')" style="width:26px;height:26px;border-radius:13px;background:rgba(254,240,138,.12);border:1px solid rgba(254,240,138,.35);color:#FEF08A;font-weight:900;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center">?</button>`; }

function htmlBanner(msg, tipo){
  const bg=tipo==='ganado'?'rgba(5,150,105,.15)':tipo==='perdido'?'rgba(239,68,68,.12)':'rgba(254,240,138,.06)';
  const bc=tipo==='ganado'?'#059669':tipo==='perdido'?'#EF4444':'#EAB308';
  const col=tipo==='ganado'?'#34D399':tipo==='perdido'?'#F87171':'#FEF08A';
  return `<div style="background:${bg};border:1.5px solid ${bc};border-radius:10px;padding:12px;margin:10px 0;text-align:center;color:${col};font-weight:800;font-size:13px">${msg}</div>`;
}

function htmlSelectorApuesta(val, onMinus, onPlus, onTodo){
  return `<div style="display:flex;align-items:center;gap:10px;justify-content:center;margin:10px 0">
    <span style="color:#9CA3AF;font-size:13px;font-weight:700">Apuesta:</span>
    <div style="display:flex;align-items:center;background:rgba(0,0,0,.3);border-radius:8px;border:1px solid rgba(255,255,255,.1)">
      <button onclick="${onMinus}" style="padding:10px;background:none;border:none;cursor:pointer;color:#FEF08A;font-size:16px">−</button>
      <span style="min-width:40px;text-align:center;font-weight:900;color:#FEF08A;font-size:16px">${val}</span>
      <button onclick="${onPlus}" style="padding:10px;background:none;border:none;cursor:pointer;color:#FEF08A;font-size:16px">+</button>
    </div>
    <button onclick="${onTodo}" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);border-radius:8px;padding:8px 10px;color:#F87171;font-weight:900;font-size:11px;cursor:pointer">TODO</button>
  </div>`;
}

const C = { bg:'#0F1923', surface:'#1C1130', border:'rgba(91,50,129,.4)', accent:'#7C3AED', gold:'#FEF08A', success:'#059669', danger:'#EF4444' };
const s = (extra='') => `background:${C.surface};border-radius:14px;padding:14px;border:1px solid ${C.border};margin-bottom:12px;${extra}`;
const btn = (label, onclick, bg=C.accent, extra='') => `<button onclick="${onclick}" style="background:${bg};color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;font-size:14px;letter-spacing:.5px;cursor:pointer;margin-bottom:6px;${extra}">${label}</button>`;
const btnBack = (onclick) => `<button onclick="${onclick}" style="background:rgba(55,65,81,1);color:#D1D5DB;border:none;border-radius:12px;padding:12px;width:100%;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:6px">← SALIR AL MENÚ</button>`;
const hud = () => `<div style="display:flex;align-items:center;justify-content:space-between;background:#1A0A2E;padding:13px 16px;border-bottom:1px solid rgba(254,240,138,.15)">
  <span style="color:#fff;font-weight:900;font-size:13px;letter-spacing:2px">🎰 LA BODEGUILLA</span>
  <div style="display:flex;align-items:center;gap:8px">
    <button onclick="window._casinoRanking()" style="width:30px;height:30px;border-radius:15px;background:rgba(254,240,138,.08);border:1px solid rgba(254,240,138,.2);cursor:pointer;font-size:14px">🏆</button>
    <div style="background:rgba(254,240,138,.12);border:1px solid rgba(254,240,138,.3);border-radius:20px;padding:5px 12px;display:flex;align-items:center;gap:5px">
      <span style="color:#C4B5FD;font-size:11px;font-weight:700">${nombreJugador}</span>
      <span style="color:#FEF08A;font-size:13px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#F59E0B;border:2px solid #D97706;vertical-align:middle;margin:0 1px"></span></span>
      <span style="color:#fff;font-weight:900;font-size:14px">${monedas}</span>
    </div>
  </div>
</div>`;

function htmlLobby(){
  const tarjeta=(icon,titulo,sub,juego,iconBg,iconColor)=>`
    <button onclick="window._casinoJuego('${juego}')" style="width:100%;background:#1C1130;border-radius:14px;padding:14px;border:1px solid rgba(91,50,129,.4);margin-bottom:10px;display:flex;align-items:center;gap:12px;cursor:pointer;text-align:left">
      <div style="width:44px;height:44px;border-radius:22px;background:${iconBg};border:1px solid ${iconColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">${icon}</div>
      <div style="flex:1"><div style="color:#fff;font-weight:900;font-size:15px;letter-spacing:.5px">${titulo}</div><div style="color:#6B7280;font-size:11px;margin-top:2px">${sub}</div></div>
      <span style="color:#FEF08A;font-size:20px;font-weight:900">›</span>
    </button>`;
  return `
    ${hud()}
    <div style="padding:14px;overflow-y:auto;flex:1">
      ${tarjeta('🃏','BLACK JACK','La mesa clásica · Apuesta libre','blackjack','rgba(254,240,138,.1)','rgba(254,240,138,.25)')}
      ${tarjeta('🎡','RULETA EUROPEA','Tapete táctil · Paga x36 al número','ruleta','rgba(21,128,61,.25)','rgba(21,128,61,.5)')}
      ${tarjeta('🎰','CUBATAS JACKPOT','Tragaperras · 9 símbolos · x60 trifecta','slots','rgba(180,83,9,.25)','rgba(180,83,9,.5)')}
      ${tarjeta('🎲','DADOS — CRAPS','7 u 11 ganas · 2,3,12 pierdes · x2','dados','rgba(239,68,68,.2)','rgba(239,68,68,.4)')}
      ${tarjeta('🎟️','RASCA Y GANA','6 casillas · Par x4 · Trifecta hasta x80','rasca','rgba(16,185,129,.2)','rgba(16,185,129,.4)')}
      ${tarjeta('⚔️','WAR — CARTA ALTA','Tú vs crupier · Empate → ¡guerra! · x2','war','rgba(245,158,11,.2)','rgba(245,158,11,.4)')}
    </div>`;
}

function htmlBlackjack(){
  const pJ = bjManoJ.length ? calcularMano(bjManoJ) : 0;
  const pC = bjManoC.length ? calcularMano(bjManoC) : 0;
  const jugando = bjFase==='jugando' || bjFase==='split2';
  const resultado = bjFase==='resultado';
  const lobby = !bjVerTapete;

  // Render carta compatible con nuevo formato {nombre, valor, palo}
  const htmlCartaBJ = (c, oculta=false) => {
    if(oculta) return `<div style="width:56px;height:84px;border-radius:8px;background:#2E1065;border:2px solid rgba(196,181,253,.5);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0"><img src="assets/Javicristo.png" style="width:100%;height:100%;object-fit:cover"/></div>`;
    const col = ['♥','♦'].includes(c.palo)?'#C94A3F':'#111111';
    return `<div style="width:56px;height:84px;border-radius:8px;background:#fff;border:1px solid #D1D5DB;padding:5px;display:flex;flex-direction:column;justify-content:space-between;flex-shrink:0;box-shadow:0 3px 6px rgba(0,0,0,.3)">
      <div style="font-size:13px;font-weight:900;color:${col};line-height:1">${c.nombre}<br><span style="font-size:11px">${c.palo}</span></div>
      <div style="font-size:22px;text-align:center;color:${col}">${c.palo}</div>
    </div>`;
  };

  const rowCartas = (mano, oculta1=false) =>
    `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;min-height:90px;margin-bottom:10px">${mano.map((c,i)=>htmlCartaBJ(c, oculta1&&i===1)).join('')}</div>`;

  const bannerRes = (msg, tipo, msg2='', tipo2='') => {
    const b = htmlBanner(msg, tipo);
    const b2 = msg2 ? htmlBanner(msg2, tipo2) : '';
    return b + b2;
  };

  if(lobby) return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:14px">
        <span style="color:#fff;font-weight:900;font-size:15px;flex:1">🃏 BLACK JACK</span>
        ${btnAyuda('blackjack')}
      </div>
      <div style="${s()}">
        <div style="color:#9CA3AF;font-size:10px;font-weight:800;letter-spacing:2px;margin-bottom:12px">
          RACHA: <span style="color:#FEF08A">${rachaActual}</span> · RÉCORD: <span style="color:#34D399">${rachaMaxima}</span>
        </div>
        ${htmlSelectorApuesta(bjApuesta,"window._bjApuesta(-10)","window._bjApuesta(10)","window._bjTodo()")}
        ${btn('REPARTIR CARTAS','window._bjIniciar()')}
        ${btnBack("window._casinoLobby()")}
      </div>
    </div>`;

  return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">

      <!-- CRUPIER -->
      <div style="text-align:center;color:#9CA3AF;font-size:10px;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">
        CRUPIER${resultado?' — '+pC:''}
      </div>
      ${rowCartas(bjManoC, jugando)}

      <div style="border-top:1px solid rgba(255,255,255,.08);margin:8px 0"></div>

      <!-- JUGADOR mano principal -->
      <div style="text-align:center;color:#9CA3AF;font-size:10px;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">
        TÚ — ${pJ}${pJ===21?' 🎉':pJ>21?' 💥':''}
        ${bjJugandoSplit?' <span style="color:#FEF08A">(MANO 1)</span>':''}
      </div>
      ${rowCartas(bjManoJ)}

      <!-- MANO SPLIT si existe -->
      ${bjManoSplit.length>0?`
        <div style="text-align:center;color:#9CA3AF;font-size:10px;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">
          MANO 2 — ${calcularMano(bjManoSplit)}
          ${bjJugandoSplit?' <span style="color:#FEF08A">(JUGANDO)</span>':''}
        </div>
        ${rowCartas(bjManoSplit)}
        ${bjResultadoSplit?htmlBanner(bjMensajeSplit,bjResultadoSplit):''}
      `:''}

      <!-- RESULTADO -->
      ${bjMensaje?htmlBanner(bjMensaje,bjResultado):''}

      <!-- SEGURO -->
      ${bjFase==='seguro'?`
        <div style="background:rgba(254,240,138,.08);border:1px solid rgba(254,240,138,.3);border-radius:12px;padding:14px;margin-bottom:10px;text-align:center">
          <div style="color:#FEF08A;font-weight:800;font-size:13px;margin-bottom:6px">El crupier muestra un As. ¿Seguro?</div>
          <div style="color:#9CA3AF;font-size:11px;margin-bottom:12px">Cuesta ${Math.floor(bjApuesta/2)} monedas · Paga 2:1 si tiene Blackjack</div>
          <div style="display:flex;gap:8px">
            <button onclick="window._bjRechazarSeguro()" style="flex:1;background:#374151;color:#fff;border:none;border-radius:12px;padding:13px;font-weight:900;cursor:pointer">NO, SEGUIR</button>
            <button onclick="window._bjAceptarSeguro()" style="flex:1;background:${C.accent};color:#fff;border:none;border-radius:12px;padding:13px;font-weight:900;cursor:pointer">CONTRATAR</button>
          </div>
        </div>`:''}

      <!-- BOTONES EN PARTIDA -->
      ${jugando && bjFase!=='seguro'?`
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <button onclick="window._bjPedir()" style="flex:1;background:${C.accent};color:#fff;border:none;border-radius:12px;padding:14px;font-weight:900;cursor:pointer">PEDIR</button>
          <button onclick="window._bjPlantar()" style="flex:1;background:#374151;color:#fff;border:none;border-radius:12px;padding:14px;font-weight:900;cursor:pointer">PLANTARSE</button>
        </div>
        ${bjPuedeDoble||bjPuedeSplit?`
        <div style="display:flex;gap:8px;margin-bottom:8px">
          ${bjPuedeDoble?`<button onclick="window._bjDoblar()" style="flex:1;background:rgba(254,240,138,.12);border:1px solid rgba(254,240,138,.35);color:#FEF08A;border-radius:12px;padding:12px;font-weight:900;font-size:12px;cursor:pointer">DOBLAR<br><span style="font-size:10px;color:#9CA3AF">×2 apuesta</span></button>`:''}
          ${bjPuedeSplit?`<button onclick="window._bjSplit()" style="flex:1;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);color:#34D399;border-radius:12px;padding:12px;font-weight:900;font-size:12px;cursor:pointer">SPLIT<br><span style="font-size:10px;color:#9CA3AF">dividir mano</span></button>`:''}
          ${bjPuedeDoble?`<button onclick="window._bjRendirse()" style="flex:1;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#F87171;border-radius:12px;padding:12px;font-weight:900;font-size:12px;cursor:pointer">RENDIRSE<br><span style="font-size:10px;color:#9CA3AF">-${Math.floor(bjApuesta/2)}</span></button>`:''}
        </div>`:''}
      `:''}

      <!-- BOTONES POST-MANO -->
      ${resultado?`
        <button onclick="window._bjIniciar()" style="background:#059669;color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;font-size:14px;cursor:pointer;margin-bottom:6px">NUEVA MANO</button>
        <button onclick="window._bjLobby()" style="background:#374151;color:#D1D5DB;border:none;border-radius:12px;padding:12px;width:100%;font-weight:700;font-size:13px;cursor:pointer">← SALIR AL MENÚ</button>
      `:''}
    </div>`;
}

function htmlRuleta(){
  const coloresTapete={rojo:'#991B1B',negro:'#111',verde:'#166534'};
  const numColor=n=>{const r=NUMEROS_RULETA.find(x=>x.n===n);return r?coloresTapete[r.c]:'#166534';};
  const fichasDisp=[1,5,10,25,50];
  const totalApostado=Object.values(fichasRuleta).reduce((a,b)=>a+b,0);
  const numeros=[];
  for(let fila=0;fila<3;fila++){
    for(let col=1;col<=12;col++){
      const n=col*3-(2-fila);
      if(n>=1&&n<=36) numeros.push(n);
    }
  }
  return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:12px">
        <span style="color:#fff;font-weight:900;font-size:15px;flex:1">🎡 RULETA EUROPEA</span>
        ${btnAyuda('ruleta')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,.4);border-radius:12px;padding:12px;margin-bottom:12px">
        <div><div style="color:#9CA3AF;font-size:10px;font-weight:800;letter-spacing:1.5px">EN MESA</div><div style="color:#FEF08A;font-size:20px;font-weight:900">${totalApostado} <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#F59E0B;border:2px solid #D97706;vertical-align:middle;margin:0 1px"></span></div></div>
        <div style="display:flex;gap:6px">
          ${fichasDisp.map(f=>`<button onclick="window._ruletaFicha(${f})" style="width:36px;height:36px;border-radius:18px;background:${fichaSeleccionada===f?C.accent:'#1C1130'};border:2px solid ${fichaSeleccionada===f?'#FEF08A':C.border};color:${fichaSeleccionada===f?'#FEF08A':'#9CA3AF'};font-size:11px;font-weight:900;cursor:pointer">${f}</button>`).join('')}
        </div>
      </div>
      <div style="background:#14532D;border-radius:12px;padding:8px;border:1px solid rgba(255,255,255,.1);margin-bottom:12px;overflow-x:auto">
        <div style="display:flex;gap:3px">
          <button onclick="window._ruletaApostar('numero',0)" style="width:36px;height:100px;background:#166534;border:1px solid rgba(255,255,255,.3);border-radius:4px;color:#fff;font-size:12px;font-weight:900;cursor:pointer;flex-shrink:0;position:relative">
            0${fichasRuleta['numero_0']?`<span style="position:absolute;bottom:2px;right:2px;background:#FEF08A;border-radius:6px;padding:1px 4px;font-size:9px;color:#000;font-weight:900">${fichasRuleta['numero_0']}</span>`:''}
          </button>
          <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:2px;flex:1">
            ${Array.from({length:36},(_,i)=>{const n=i+1;const bg=numColor(n);const k=`numero_${n}`;return `<button onclick="window._ruletaApostar('numero',${n})" style="aspect-ratio:1;background:${bg};border:1px solid rgba(255,255,255,.2);border-radius:3px;color:#fff;font-size:9px;font-weight:900;cursor:pointer;position:relative;min-width:24px">${n}${fichasRuleta[k]?`<span style="position:absolute;bottom:1px;right:1px;background:#FEF08A;border-radius:5px;padding:0 3px;font-size:8px;color:#000;font-weight:900">${fichasRuleta[k]}</span>`:''}</button>`}).join('')}
          </div>
        </div>
        <div style="display:flex;gap:4px;margin-top:6px">
          ${[['color','rojo','🔴 ROJOS'],['color','negro','⚫ NEGROS'],['paridad','par','PARES'],['paridad','impar','IMPARES']].map(([t,v,l])=>`
            <button onclick="window._ruletaApostar('${t}','${v}')" style="flex:1;background:${fichasRuleta[`${t}_${v}`]?C.accent:'#166534'};border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#fff;font-size:10px;font-weight:800;cursor:pointer;padding:8px 4px;position:relative">
              ${l}${fichasRuleta[`${t}_${v}`]?`<span style="position:absolute;top:-4px;right:-4px;background:#FEF08A;border-radius:8px;padding:1px 4px;font-size:9px;color:#000;font-weight:900">${fichasRuleta[`${t}_${v}`]}</span>`:''}
            </button>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="window._ruletaLimpiar()" style="flex:1;background:#374151;color:#D1D5DB;border:none;border-radius:12px;padding:12px;font-weight:700;cursor:pointer">LIMPIAR</button>
        <button onclick="window._ruletaGirar()" style="flex:2;background:${C.accent};color:#fff;border:none;border-radius:12px;padding:14px;font-weight:900;font-size:14px;cursor:pointer">${girandoRuleta?'GIRANDO...':'🎡 GIRAR'}</button>
        ${btnBack("window._casinoLobby()").replace('width:100%','flex:1')}
      </div>
    </div>`;
}

function htmlSlots(){
  return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">
      <div style="background:#1C1130;border-radius:16px;padding:14px;border:2px solid #2E1065">
        <div style="display:flex;align-items:center;justify-content:center;background:#4C1D95;border-radius:10px;border:1.5px solid #FEF08A;padding:10px;margin-bottom:14px;position:relative">
          <span style="color:#FEF08A;font-weight:900;font-size:15px;letter-spacing:3px">CUBATAS JACKPOT</span>
          <div style="position:absolute;right:10px">${btnAyuda('slots')}</div>
        </div>
        <div style="background:#0D0D0D;border-radius:12px;padding:16px;border:2px solid #EAB308;margin-bottom:12px">
          <div style="display:flex;justify-content:center;gap:14px">
            ${slotsValores.map(s=>`<div style="width:76px;height:88px;background:#1F1F1F;border-radius:10px;display:flex;align-items:center;justify-content:center;border:2px solid #EAB308;font-size:40px">${s}</div>`).join('')}
          </div>
        </div>
        ${mensajeSlots?htmlBanner(mensajeSlots,mensajeSlots.includes('🎉')||mensajeSlots.includes('✨')?'ganado':'perdido'):''}
        ${htmlSelectorApuesta(apuestaSlots,"window._slotsApuesta(-10)","window._slotsApuesta(10)","window._slotsTodo()")}
        <button onclick="window._slotsJugar()" style="background:#7C3AED;color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;font-size:14px;cursor:pointer;margin-bottom:6px">${girandoSlots?'GIRANDO...':'🎰 TIRAR PALANCA'}</button>
        ${btnBack("window._casinoLobby()")}
        <div style="background:#0D0D0D;border-radius:8px;padding:8px;margin-top:8px;text-align:center;border:1px solid #292524">
          <div style="color:#EAB308;font-size:10px;font-weight:900;letter-spacing:1.5px;margin-bottom:4px">PREMIOS</div>
          <div style="color:#D1D5DB;font-size:10px;font-weight:700">💎×3 → x60 · 💵×3 → x40 · 🥩×3 → x25 · Par → x3</div>
        </div>
      </div>
    </div>`;
}

function htmlDados(){
  const suma=dadosValores[0]&&dadosValores[1]?dadosValores[0]+dadosValores[1]:null;
  return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:14px">
        <span style="color:#fff;font-weight:900;font-size:15px;flex:1">🎲 DADOS — CRAPS</span>
        ${btnAyuda('dados')}
        ${dadosPunto!==null?`<div style="background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.5);border-radius:8px;padding:4px 10px"><span style="color:#F87171;font-weight:900;font-size:12px">PUNTO: ${dadosPunto}</span></div>`:''}
      </div>
      <div style="display:flex;justify-content:center;gap:20px;margin-bottom:16px">
        ${htmlDado(dadosValores[0],dadosTirandose)}
        ${htmlDado(dadosValores[1],dadosTirandose)}
      </div>
      ${suma!==null?`<div style="text-align:center;margin-bottom:10px"><span style="color:#9CA3AF;font-size:11px;font-weight:700;letter-spacing:1.5px">SUMA</span><div style="color:#FEF08A;font-size:36px;font-weight:900">${suma}</div></div>`:''}
      ${dadosMensaje?htmlBanner(dadosMensaje,dadosMensaje.includes('🏆')||dadosMensaje.includes('🎲 ¡7')||dadosMensaje.includes('🎲 ¡11')?'ganado':dadosMensaje.includes('💀')?'perdido':''):''}
      ${!dadosMensaje&&dadosFase==='inicio'?`<div style="background:rgba(0,0,0,.25);border-radius:10px;padding:12px;margin-bottom:10px;border:1px solid rgba(255,255,255,.06);color:#9CA3AF;font-size:11px;font-weight:600;text-align:center;line-height:18px">7 u 11 → ganas · 2, 3 o 12 → pierde<br>Otro número → se convierte en tu punto<br>Saca el punto antes que el 7</div>`:''}
      ${dadosFase==='inicio'?htmlSelectorApuesta(apuestaDados,"window._dadosApuesta(-10)","window._dadosApuesta(10)","window._dadosTodo()"):''}
      <button onclick="window._dadosTirar()" style="background:#059669;color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;font-size:14px;cursor:pointer;margin-bottom:6px">${dadosTirandose?'RODANDO...':dadosFase==='punto'?`TIRAR OTRA VEZ (PUNTO: ${dadosPunto})`:'🎲 LANZAR DADOS'}</button>
      ${btnBack("window._casinoLobby()")}
    </div>`;
}

function htmlRasca(){
  cargarLimiteRasca();
  const limitado = rascaTiradasHoy >= RASCA_LIMITE_DIARIO;
  return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:14px">
        <span style="color:#fff;font-weight:900;font-size:15px;flex:1">🎟️ RASCA Y GANA</span>
        ${btnAyuda('rasca')}
      </div>
      ${rascaFase==='comprar'?`
        <div style="${s('text-align:center')}">
          <div style="font-size:42px;margin-bottom:8px">🎟️</div>
          <div style="color:#fff;font-weight:900;font-size:15px;margin-bottom:4px">CARTÓN LA BODEGUILLA</div>
          <div style="color:#9CA3AF;font-size:11px;margin-bottom:12px;line-height:17px">9 símbolos · 6 casillas · Par x2<br>💎×3 → x25 · 💵×3 → x15 · resto → x8</div>
          <div style="background:${limitado?'rgba(239,68,68,.15)':'rgba(52,211,153,.1)'};border:1px solid ${limitado?'rgba(239,68,68,.4)':'rgba(52,211,153,.3)'};border-radius:10px;padding:10px;margin-bottom:14px">
            <span style="color:${limitado?'#F87171':'#34D399'};font-size:12px;font-weight:800">
              ${limitado?`Límite diario alcanzado — vuelve mañana`:`Tiradas hoy: ${rascaTiradasHoy} / ${RASCA_LIMITE_DIARIO}`}
            </span>
          </div>
          ${htmlSelectorApuesta(rascaApuesta,"window._rascaApuesta(-10)","window._rascaApuesta(10)","window._rascaTodo()")}
          <button onclick="window._rascaComprar()" ${limitado?'disabled':''} style="background:${limitado?'#374151':C.accent};color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;font-size:14px;cursor:${limitado?'default':'pointer'};margin-bottom:6px;opacity:${limitado?0.5:1}">🎟️ COMPRAR CARTÓN</button>
          ${btnBack("window._casinoLobby()")}
        </div>`:`
        ${rascaMensaje?htmlBanner(rascaMensaje,rascaResultado):'<div style="color:#9CA3AF;font-size:12px;text-align:center;margin-bottom:10px">Toca cada casilla para rascar...</div>'}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
          ${rascaCasillas.map((c,i)=>`
            <button onclick="window._rascaCasilla(${i})" ${c.revelada||rascaFase==='fin'?'disabled':''}
              style="height:96px;border-radius:12px;background:${c.revelada?'#1C1130':'#2E1065'};border:2px solid ${c.revelada?'rgba(52,211,153,.4)':'rgba(167,139,250,.4)'};display:flex;align-items:center;justify-content:center;cursor:${c.revelada||rascaFase==='fin'?'default':'pointer'};font-size:${c.revelada?'34':'26'}px">
              ${c.revelada?c.simbolo:'<span style="color:rgba(255,255,255,.3)">?</span>'}
            </button>`).join('')}
        </div>
        ${rascaFase==='rascando'?`<button onclick="window._rascaRevelar()" style="background:#374151;color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;cursor:pointer;margin-bottom:6px">REVELAR TODO</button>`:''}
        ${rascaFase==='fin'?btn('OTRO CARTÓN','window._rascaNuevo()','#059669'):''}
        ${btnBack("window._casinoLobby()")}
      `}
    </div>`;
}

function htmlWar(){
  const cardSlot=(carta,oculta=false)=>`<div style="min-height:90px;display:flex;align-items:center;justify-content:center">${carta?htmlCarta(oculta?{figura:'?',palo:'♠'}:carta,oculta):`<div style="width:56px;height:84px;border-radius:8px;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center"><span style="color:rgba(255,255,255,.2);font-size:24px">—</span></div>`}</div>`;
  return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">
      <div style="display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:14px">
        <span style="color:#fff;font-weight:900;font-size:15px;flex:1">⚔️ WAR — CARTA ALTA</span>
        ${btnAyuda('war')}
      </div>
      <div style="margin-bottom:14px">
        <div style="text-align:center;color:#9CA3AF;font-size:10px;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">CRUPIER</div>
        ${cardSlot(warCartaC,warAnimando)}
        <div style="display:flex;align-items:center;gap:8px;margin:8px 0"><div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div><span style="color:#FBBF24;font-weight:900;font-size:13px;letter-spacing:2px">VS</span><div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div></div>
        <div style="text-align:center;color:#9CA3AF;font-size:10px;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">TÚ</div>
        ${cardSlot(warCartaJ,warAnimando)}
      </div>
      ${warCartasGuerra?`
        <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px;margin-bottom:10px;text-align:center">
          <div style="color:#F87171;font-size:10px;font-weight:800;letter-spacing:1.5px;margin-bottom:8px">⚔️ CARTA DECISIVA</div>
          <div style="display:flex;justify-content:center;gap:20px">
            <div><div style="color:#9CA3AF;font-size:9px;font-weight:700;margin-bottom:4px">TÚ</div>${htmlCarta(warCartasGuerra.j)}</div>
            <div><div style="color:#9CA3AF;font-size:9px;font-weight:700;margin-bottom:4px">CRUPIER</div>${htmlCarta(warCartasGuerra.c)}</div>
          </div>
        </div>`:''}
      ${warMensaje?htmlBanner(warMensaje,warResultado):''}
      ${warFase==='inicio'?htmlSelectorApuesta(warApuesta,"window._warApuesta(-10)","window._warApuesta(10)","window._warTodo()"):''}
      ${warFase==='inicio'?btn(warAnimando?'REPARTIENDO...':'⚔️ REPARTIR CARTAS','window._warJugar()'):''}
      ${warFase==='empate'?`
        <button onclick="window._warGuerra()" style="background:${C.accent};color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;font-size:13px;cursor:pointer;margin-bottom:6px">⚔️ IR A LA GUERRA (doblar: ${warApuesta*2})</button>
        <button onclick="window._warRendirse()" style="background:#374151;color:#fff;border:none;border-radius:12px;padding:14px;width:100%;font-weight:900;font-size:13px;cursor:pointer;margin-bottom:6px">🏳️ RENDIRSE (-${Math.floor(warApuesta/2)} monedas)</button>`:''}
      ${warFase==='fin'?btn('NUEVA MANO','window._warReset()','#059669'):''}
      ${btnBack("window._casinoLobby()")}
    </div>`;
}

function htmlRanking(){
  return `
    ${hud()}
    <div style="background:${C.bg};padding:14px;overflow-y:auto;flex:1">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="color:#FEF08A;font-size:18px">🏆</span>
        <span style="color:#fff;font-weight:900;font-size:18px;letter-spacing:2px;flex:1">RANKING</span>
        <button onclick="window._casinoRanking()" style="padding:8px;background:rgba(255,255,255,.06);border:none;border-radius:8px;color:#6B7280;cursor:pointer;font-size:14px">↺</button>
      </div>
      <div style="background:rgba(254,240,138,.06);border:1px solid rgba(254,240,138,.15);border-radius:10px;padding:12px;margin-bottom:16px;text-align:center">
        <span style="color:#FEF08A;font-size:11px;font-weight:700">Puntos = monedas × (1 − bancarrotas × 0.08) · mínimo ×0.2</span>
      </div>
      ${rankingData.map((j,idx)=>{
        const medalla=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':null;
        const esTu=j.nombre===nombreJugador;
        return `<div style="background:${esTu?'rgba(124,58,237,.18)':'#1C1130'};border-radius:12px;padding:14px;margin-bottom:8px;border:1px solid ${esTu?'rgba(124,58,237,.7)':idx<3?'rgba(254,240,138,.2)':'rgba(91,50,129,.3)'};display:flex;align-items:center;gap:12px">
          <div style="width:34px;text-align:center">${medalla?`<span style="font-size:22px">${medalla}</span>`:`<span style="color:#6B7280;font-weight:900;font-size:14px">#${idx+1}</span>`}</div>
          <div style="flex:1">
            <div style="color:#fff;font-weight:900;font-size:15px">${j.nombre}${esTu?' 👈':''}</div>
            <div style="display:flex;gap:8px;margin-top:3px">
              <span style="color:#9CA3AF;font-size:11px;font-weight:600"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#F59E0B;border:2px solid #D97706;vertical-align:middle;margin:0 1px"></span> ${j.monedas}</span>
              ${j.bancarrotas>0?`<span style="color:#F87171;font-size:11px;font-weight:600">💸 ×${j.bancarrotas}</span>`:''}
            </div>
          </div>
          <div style="text-align:right"><div style="color:#FEF08A;font-weight:900;font-size:18px">${j.puntuacion||0}</div><div style="color:#6B7280;font-size:10px;font-weight:600">pts</div></div>
        </div>`;
      }).join('')}
      ${rankingData.length===0?'<p style="color:#6B7280;text-align:center;margin-top:40px">Nadie en el ranking todavía.</p>':''}
      ${btnBack("window._casinoLobby()")}
    </div>`;
}

const AYUDAS = {
  blackjack: {t:'🃏 Black Jack',r:[
    'Objetivo: llegar a 21 sin pasarte y ganar al crupier.',
    'Zapato de 4 barajas. As vale 1 u 11. J,Q,K valen 10.',
    'PEDIR: recibes una carta más.',
    'PLANTARSE: el crupier completa su mano (se planta en 17+).',
    'DOBLAR: doblas la apuesta, recibes solo 1 carta más.',
    'SPLIT: si tus 2 cartas tienen el mismo valor, las divides en 2 manos.',
    'RENDIRSE: en la primera jugada, recuperas la mitad de la apuesta.',
    'SEGURO: si el crupier muestra As, puedes apostar contra su Blackjack (paga 2:1).',
    'Blackjack natural (As+10 con 2 cartas) paga 3:2 y gana al 21 normal.',
  ],p:'Victoria → x2 · Blackjack natural → x2.5 · Doble → x2 apuesta doble'},
  ruleta: {t:'🎡 Ruleta Europea',r:['Elige una ficha (1-50) y toca donde quieras apostar.','Puedes apostar a números, colores o pares/impares.','Pulsa GIRAR para lanzar la bola.','El 0 hace perder todas las apuestas de color y paridad.'],p:'Número → x36 · Color/Paridad → x2'},
  slots: {t:'🎰 Cubatas Jackpot',r:['Elige tu apuesta y pulsa TIRAR PALANCA.','Si dos o tres símbolos coinciden, ganas premio.','El 💎 es el símbolo más valioso.'],p:'Par → x3 · Trifecta: 💎×60 · 💵×40 · resto×15'},
  dados: {t:'🎲 Dados — Craps',r:['Tirada inicial: 7 u 11 → ganas · 2,3,12 → pierde.','Otro número se convierte en tu PUNTO.','Sigue tirando: saca el punto → ganas · saca 7 → pierde.'],p:'Victoria → x2 apuesta'},
  rasca: {t:'🎟️ Rasca y Gana',r:['Compra un cartón y rasca las 6 casillas una a una.','O usa REVELAR TODO para destapar todo de golpe.','Par (2 iguales): x4 · Trifecta (3 iguales): x20 mínimo.','💎×3 → x80 · 💵×3 → x40 · resto×3 → x20'],p:'Par → x4 · Trifecta → x20 hasta x80'},
  war: {t:'⚔️ War — Carta Alta',r:['Tú y el crupier recibís una carta. Gana el mayor.','EMPATE: puedes ir a la GUERRA (doblas) o RENDIRTE (pierdes la mitad).','En la GUERRA se reparte una carta decisiva.','El As es siempre el más alto.'],p:'Victoria → x2 · Guerra ganada → x4'},
};

function htmlAyuda(){
  const a=AYUDAS[modalAyuda];
  if(!a)return'';
  return `<div onclick="window._cerrarAyuda()" style="position:fixed;inset:0;background:rgba(10,8,14,.88);display:flex;align-items:center;justify-content:center;padding:16px;z-index:999">
    <div onclick="event.stopPropagation()" style="background:#1C1130;border-radius:14px;padding:20px;border:1px solid rgba(91,50,129,.5);width:100%;max-width:380px;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="color:#9B6DCC;font-size:11px;font-weight:800;letter-spacing:2px">${a.t}</span>
        <button onclick="window._cerrarAyuda()" style="background:transparent;border:none;color:#9CA3AF;font-size:20px;cursor:pointer">×</button>
      </div>
      ${a.r.map(r=>`<div style="display:flex;gap:8px;margin-bottom:10px"><span style="color:#FEF08A;flex-shrink:0">·</span><span style="color:#D1D5DB;font-size:13px;line-height:18px">${r}</span></div>`).join('')}
      <div style="background:rgba(254,240,138,.06);border:1px solid rgba(254,240,138,.15);border-radius:8px;padding:10px;margin-top:8px;text-align:center;color:#FEF08A;font-size:12px;font-weight:700">${a.p}</div>
      <button onclick="window._cerrarAyuda()" style="background:#7C3AED;color:#fff;border:none;border-radius:10px;padding:13px;width:100%;font-weight:900;font-size:13px;cursor:pointer;margin-top:14px">ENTENDIDO</button>
    </div>
  </div>`;
}

function htmlRegistro(){
  return `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:28px;background:#0F1923;min-height:100%">
    <div style="text-align:center;margin-bottom:40px">
      <div style="font-size:52px;margin-bottom:12px">🎰</div>
      <div style="color:#fff;font-size:26px;font-weight:900;letter-spacing:3px;margin-bottom:6px">LA BODEGUILLA</div>
      <div style="color:#6B7280;font-size:13px;font-weight:600;letter-spacing:1px">CASINO DEL PUEBLO</div>
    </div>
    <div style="background:#1C1130;border-radius:16px;padding:22px;border:1px solid rgba(124,58,237,.4)">
      <div style="color:#fff;font-size:16px;font-weight:900;text-align:center;margin-bottom:8px">¿CÓMO TE LLAMAS?</div>
      <div style="color:#9CA3AF;font-size:12px;text-align:center;margin-bottom:16px;line-height:18px">Tu nombre se guarda en este dispositivo y en el ranking compartido.</div>
      <input id="casino-nombre-input" maxlength="20" placeholder="Nombre..."
        style="width:100%;background:rgba(0,0,0,.4);border:1.5px solid rgba(124,58,237,.5);border-radius:12px;padding:14px;color:#fff;font-size:18px;font-weight:700;text-align:center;margin-bottom:14px"
        onkeydown="if(event.key==='Enter')window._casinoConfirmarNombre()" />
      <button onclick="window._casinoConfirmarNombre()" style="background:#7C3AED;color:#fff;border:none;border-radius:12px;padding:15px;width:100%;font-weight:900;font-size:15px;letter-spacing:1px;cursor:pointer">ENTRAR AL CASINO →</button>
    </div>
    <div style="color:#374151;font-size:11px;text-align:center;margin-top:20px">Empiezas con 500 monedas</div>
  </div>`;
}

function render(){
  const root=document.getElementById('casino-root');
  if(!root)return;
  let html='';
  if(pantallaC==='cargando') html=`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6B7280">Cargando...</div>`;
  else if(pantallaC==='registro') html=htmlRegistro();
  else if(pantallaC==='lobby')    html=htmlLobby();
  else if(pantallaC==='blackjack') html=htmlBlackjack();
  else if(pantallaC==='ruleta')   html=htmlRuleta();
  else if(pantallaC==='slots')    html=htmlSlots();
  else if(pantallaC==='dados')    html=htmlDados();
  else if(pantallaC==='rasca')    html=htmlRasca();
  else if(pantallaC==='war')      html=htmlWar();
  else if(pantallaC==='ranking')  html=htmlRanking();
  root.innerHTML=html+(modalAyuda?htmlAyuda():'');
}

// ── Bindings globales ─────────────────────────────────────────────────────────
window._casinoLobby   = ()=>{ pantallaC='lobby'; render(); };
window._casinoJuego   = (j)=>{
  pantallaC=j;
  // Reset BJ al entrar
  if(j==='blackjack'){
    bjVerTapete=false; bjFase='lobby'; bjManoJ=[]; bjManoC=[]; bjManoSplit=[];
    bjJugandoSplit=false; bjResultado=''; bjMensaje=''; bjResultadoSplit='';
    bjMensajeSplit=''; bjPuedeDoble=false; bjPuedeSplit=false;
    bjOfrecerSeguro=false; bjSeguroPagado=false;
  }
  render();
};
window._casinoRanking = async()=>{ await cargarRanking(); };
window._casinoAyuda   = (j)=>{ modalAyuda=j; render(); };
window._cerrarAyuda   = ()=>{ modalAyuda=null; render(); };
window._casinoConfirmarNombre = ()=>{ const n=document.getElementById('casino-nombre-input')?.value||''; confirmarNombre(n); };

// BJ — nuevos handlers completos
window._bjIniciar        = ()=>iniciarBJ();
window._bjPedir          = ()=>bjPedir();
window._bjPlantar        = ()=>bjPlantar();
window._bjDoblar         = ()=>bjDoblar();
window._bjSplit          = ()=>bjSplit();
window._bjRendirse       = ()=>bjRendirse();
window._bjAceptarSeguro  = ()=>bjAceptarSeguro();
window._bjRechazarSeguro = ()=>bjRechazarSeguro();
window._bjLobby          = ()=>{ bjVerTapete=false; bjFase='lobby'; render(); };
window._bjApuesta  = (d)=>{ bjApuesta=Math.max(10,Math.min(monedas,bjApuesta+d)); render(); };
window._bjTodo     = ()=>{ bjApuesta=monedas; render(); };

window._ruletaFicha  = (f)=>{ fichaSeleccionada=f; render(); };
window._ruletaApostar= (t,v)=>apostarRuleta(t,v);
window._ruletaLimpiar= ()=>limpiarRuleta();
window._ruletaGirar  = ()=>girarRuleta();

window._slotsJugar   = ()=>jugarSlots();
window._slotsApuesta = (d)=>{ apuestaSlots=Math.max(10,apuestaSlots+d); render(); };
window._slotsTodo    = ()=>{ apuestaSlots=monedas; render(); };

window._dadosTirar   = ()=>tirarDados();
window._dadosApuesta = (d)=>{ apuestaDados=Math.max(10,apuestaDados+d); render(); };
window._dadosTodo    = ()=>{ apuestaDados=monedas; render(); };

window._rascaComprar = ()=>comprarRasca();
window._rascaCasilla = (i)=>rascarCasilla(i);
window._rascaRevelar = ()=>revelarTodoRasca();
window._rascaNuevo   = ()=>{ rascaCasillas=[]; rascaFase='comprar'; rascaMensaje=''; rascaResultado=''; render(); };
window._rascaApuesta = (d)=>{ rascaApuesta=Math.max(10,Math.min(500,rascaApuesta+d)); render(); };
window._rascaTodo    = ()=>{ rascaApuesta=Math.min(500,monedas); render(); };

window._warJugar     = ()=>jugarWar();
window._warGuerra    = ()=>irAGuerraWar();
window._warRendirse  = ()=>rendirseWar();
window._warReset     = ()=>{ warCartaJ=null; warCartaC=null; warCartasGuerra=null; warFase='inicio'; warMensaje=''; warResultado=''; warAnimando=false; render(); };
window._warApuesta   = (d)=>{ warApuesta=Math.max(10,warApuesta+d); render(); };
window._warTodo      = ()=>{ warApuesta=monedas; render(); };

// ── Init ──────────────────────────────────────────────────────────────────────
async function init(){
  const nombre=leerLocal('@casino_nombre','');
  if(nombre){
    nombreJugador=nombre;
    // Cargar local primero para que la pantalla aparezca rápido
    monedas=parseInt(leerLocal('@bj_monedas','500'),10);
    bancarrotas=parseInt(leerLocal('@casino_bancarrotas','0'),10);
    rachaActual=parseInt(leerLocal('@bj_racha','0'),10);
    rachaMaxima=parseInt(leerLocal('@bj_racha_max','0'),10);
    pantallaC='lobby';
    render();
    // Luego consultar Supabase para sincronizar el saldo real
    try {
      const { ok, jugador } = await registrarOObtenerJugador(nombre);
      if (ok && jugador) {
        monedas     = jugador.monedas     ?? monedas;
        bancarrotas = jugador.bancarrotas ?? bancarrotas;
        // Actualizar local con el valor del servidor
        guardarLocal('@bj_monedas', monedas);
        guardarLocal('@casino_bancarrotas', bancarrotas);
        render(); // Re-renderizar con los datos frescos
      }
    } catch(e) {
      console.warn('No se pudo sincronizar con Supabase al arrancar:', e);
    }
  } else {
    pantallaC='registro';
    render();
  }
}

// Esperar a que el tab de casino sea visible
const observer=new MutationObserver(()=>{
  const root=document.getElementById('casino-root');
  if(root&&root.innerHTML===''){init();observer.disconnect();}
});
const casinoPanel=document.getElementById('panel-casino');
if(casinoPanel) observer.observe(casinoPanel,{attributes:true,attributeFilter:['class']});
else init();
