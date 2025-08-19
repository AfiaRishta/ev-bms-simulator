'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function log(msg){ const el=$('log'); const t=new Date().toLocaleTimeString(); const row=document.createElement('div'); row.className='entry'; row.textContent=`[${t}] ${msg}`; el.appendChild(row); el.scrollTop=el.scrollHeight; }

// CSV helpers
function csvFromRows(rows) {
  return rows.map(r => r.map(x => {
    const s = String(x);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replaceAll('"','""')}"` : s;
  }).join(',')).join('\n');
}
function safeDownloadCSV(filename, csv) {
  try {
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display='none'; a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log('CSV downloaded.');
  } catch (e) {
    // Fallback: open data URI in new tab (user can Ctrl+S)
    const data = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const win = window.open(data, '_blank');
    if (win) log('Opened CSV in a new tab (use Save As).');
    else alert('Your browser blocked the download. Allow popups or use Copy CSV.');
  }
}

// Minimal offline charts
const charts = (()=>{
  const maxN = 240;
  const left = { el: $('chartLeft'), series: { power:[], current:[], speed:[] } };
  const right= { el: $('chartRight'), series: { soc:[], temp:[], voltage:[] } };
  const ctxL = left.el.getContext('2d'), ctxR = right.el.getContext('2d');

  function drawAxes(ctx, w, h) {
    ctx.strokeStyle='rgba(148,163,184,0.35)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(40,10); ctx.lineTo(40,h-25); ctx.lineTo(w-10,h-25); ctx.stroke();
  }
  function drawSeries(ctx, data, color, w, h, scaleY, label){
    ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.beginPath();
    const n=data.length, maxW=w-60, baseX=40, baseY=h-25;
    for(let i=0;i<n;i++){
      const x = baseX + (i/(maxN-1))*maxW;
      const y = baseY - scaleY(data[i])*(h-45);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.fillStyle=color; ctx.fillText(label, w-110, 15 + Math.random()*8);
  }
  function addPoint(t, v){
    ['power','current','speed'].forEach(k=>{ left.series[k].push(v.A[k]); if(left.series[k].length>maxN) left.series[k].shift(); });
    ['soc','temp','voltage'].forEach(k=>{ right.series[k].push(v.B[k]); if(right.series[k].length>maxN) right.series[k].shift(); });
    render();
  }
  function render(){
    const wL=left.el.width, hL=left.el.height, wR=right.el.width, hR=right.el.height;
    ctxL.clearRect(0,0,wL,hL); ctxR.clearRect(0,0,wR,hR);
    ctxL.font='12px sans-serif'; ctxR.font='12px sans-serif';
    drawAxes(ctxL,wL,hL); drawAxes(ctxR,wR,hR);

    const spow = (y)=> (y+50)/ (200);   // -50..150 kW
    const scur = (y)=> (y+400)/ (800);  // -400..400 A
    const sspeed=(y)=> y/180;           // 0..180 km/h

    const ssoc =(y)=> y/100;            // 0..100 %
    const stemp=(y)=> (y)/90;           // 0..90 C
    const svolt=(y)=> (y-300)/300;      // 300..600 V

    drawSeries(ctxL, left.series.power,   '#60a5fa', wL,hL, spow, 'Power kW');
    drawSeries(ctxL, left.series.current, '#34d399', wL,hL, scur, 'Current A');
    drawSeries(ctxL, left.series.speed,   '#f59e0b', wL,hL, sspeed,'Speed km/h');

    drawSeries(ctxR, right.series.soc,    '#60a5fa', wR,hR, ssoc,  'SoC %');
    drawSeries(ctxR, right.series.temp,   '#ef4444', wR,hR, stemp, 'Temp C');
    drawSeries(ctxR, right.series.voltage,'#a78bfa', wR,hR, svolt, 'Voltage V');
  }
  return { addPoint, render };
})();

class EVSim {
  constructor(){
    this.capacity_kWh = parseFloat($('capacity').value);
    this.v_nom = parseFloat($('vnom').value);
    this.r_int_mohm = parseFloat($('rint').value);
    this.mass = parseFloat($('mass').value);
    this.ambient = parseFloat($('ambient').value);
    this.soc=1.0; this.soh=1.0; this.tempC=this.ambient+3; this.speed=0; this.ocv=this.v_nom; this.current=0; this.voltage=this.v_nom; this.power_kW=0;
    this.cellCount=96; this._time=0; this.profile=$('profile').value; this.chargerOn=false;
    this.faultHeat=false; this.faultNoise=false; this.faultImb=false; this.faultStuck=false; this.stuckCurrent=0;
    this.rows=[['t_s','SoC_%','SoH_%','Voltage_V','Current_A','Power_kW','Temp_C','Speed_kmh','Range_km_est','MinCell_V','MaxCell_V','CellDelta_V','Profile','Alert']];
  }
  ocvFromSoc(soc){
    const pts=[[0.0,3.20],[0.2,3.60],[0.5,3.70],[0.8,4.00],[1.0,4.20]];
    let v=3.2; for(let i=0;i<pts.length-1;i++){const [x1,y1]=pts[i],[x2,y2]=pts[i+1]; if(soc<=x2){const t=(soc-x1)/(x2-x1); v=y1+t*(y2-y1); break;}} return v*this.cellCount;
  }
  targetPower(profile,t){
    const rnd=(a,b)=>a+Math.random()*(b-a);
    if(profile==='idle') return rnd(0.4,1.6);
    if(profile==='city'){ const base=5+20*Math.max(0,Math.sin(t/2))+rnd(-5,5); const regen=Math.random()<0.25?-rnd(5,15):0; return clamp(base+regen,-20,60); }
    if(profile==='highway'){ const base=30+10*Math.sin(t/8)+rnd(-5,5); const regen=Math.random()<0.1?-rnd(3,10):0; return clamp(base+regen,-15,90); }
    if(profile==='hills'){ const cyc=Math.sin(t/6); const base=cyc>0?60+25*cyc:-25*(-cyc); return clamp(base+rnd(-5,5),-40,120); }
    return 0;
  }
  step(dt){
    this.capacity_kWh=parseFloat($('capacity').value); this.v_nom=parseFloat($('vnom').value); this.r_int_mohm=parseFloat($('rint').value);
    this.mass=parseFloat($('mass').value); this.ambient=parseFloat($('ambient').value); this.profile=$('profile').value; this.chargerOn=$('charger').checked;
    this.faultHeat=$('faultHeat').checked; this.faultNoise=$('faultNoise').checked; this.faultImb=$('faultImb').checked; this.faultStuck=$('faultStuck').checked;

    let p_dem_kW=this.targetPower(this.profile,this._time);
    if(this.chargerOn && this.soc<0.95) p_dem_kW -= 7;

    const driveForce=Math.max(0,p_dem_kW*1000)/Math.max(1,(this.speed/3.6+0.1));
    const accel=driveForce/this.mass; const speed_ms=clamp(this.speed/3.6+accel*dt-0.01*(this.speed/3.6)**2*dt,0,60); this.speed=speed_ms*3.6;

    this.ocv=this.ocvFromSoc(this.soc)*(0.98+0.02*this.soh);
    const R=(this.r_int_mohm/1000.0), P=p_dem_kW*1000; let I=0;
    if(this.faultStuck){ if(this._time===0) this.stuckCurrent=0; I=this.stuckCurrent; }
    else{
      const a=R, b=-this.ocv, c=P, disc=b*b-4*a*c;
      if(disc>=0 && Math.abs(a)>1e-9){ const r1=(-b+Math.sqrt(disc))/(2*a), r2=(-b-Math.sqrt(disc))/(2*a); I=Math.abs(r1)<Math.abs(r2)?r1:r2; }
      else I=P/Math.max(1,this.ocv);
      I += (Math.random()-0.5)*2*(this.faultNoise?5.0:0.5);
      this.stuckCurrent=I;
    }
    this.voltage=clamp(this.ocv - I*R, 0, 1e6);
    this.power_kW=(this.voltage*I)/1000.0;

    const cap_Ah=(this.capacity_kWh*1000)/this.v_nom;
    const dQ_Ah=(I*dt)/3600.0; this.soc=clamp(this.soc - (dQ_Ah/cap_Ah), 0, 1);

    const heatW=(I*I)*R, thermalMass=45000, cooling=(this.tempC-this.ambient)*(this.faultHeat?0.3:1.2);
    const dT=(heatW/thermalMass - cooling/1000)*dt; this.tempC=clamp(this.tempC+dT, -20, 90);

    const stress=(this.tempC>45?1.0:0.2)+(Math.abs(I)>200?0.6:0.1); const fade=1e-7*stress*Math.abs(I); this.soh=clamp(this.soh-fade, 0.6, 1.0);

    const vcell_mean=this.voltage/this.cellCount; const imb=this.faultImb?0.05:0.01;
    const vmin=clamp(vcell_mean-imb/2+(Math.random()-0.5)*imb*0.2, 2.7,4.25);
    const vmax=clamp(vcell_mean+imb/2+(Math.random()-0.5)*imb*0.2, 2.7,4.25);
    const delta=Math.max(0,vmax-vmin);

    const alerts=[];
    if(this.soc<=0.1) alerts.push('LOW_SoC'); if(this.tempC>=60) alerts.push('OVER_TEMP'); if(vmin<=3.0) alerts.push('CELL_UNDERVOLT');
    if(delta>=0.03) alerts.push('CELL_IMBALANCE'); if(Math.abs(I)>=400) alerts.push('HIGH_CURRENT');
    const alertText=alerts.length?alerts.join(', '):'';

    const speed_kmh=this.speed;
    const consumption_kW_per_kmh=(Math.abs(this.power_kW)+1.0)/Math.max(10, speed_kmh+1);
    const kWhPer100=consumption_kW_per_kmh*100; const remaining_kWh=this.capacity_kWh*this.soc*this.soh;
    const range_km=Math.min(700, (remaining_kWh/Math.max(0.12,kWhPer100/100))*100);

    if (Math.floor(this._time) !== Math.floor(this._time - dt)) {
      this.rows.push([
        this._time.toFixed(1),(this.soc*100).toFixed(2),(this.soh*100).toFixed(2),
        this.voltage.toFixed(1), I.toFixed(2), this.power_kW.toFixed(2), this.tempC.toFixed(2),
        speed_kmh.toFixed(1), Number.isFinite(range_km)?range_km.toFixed(1):'--',
        (vmin).toFixed(3),(vmax).toFixed(3),(delta).toFixed(3), this.profile, alertText
      ]);
    }

    $('socText').textContent=`${(this.soc*100).toFixed(0)}%`;
    $('soh').textContent=`${(this.soh*100).toFixed(1)}%`; $('voltage').textContent=`${this.voltage.toFixed(1)} V`;
    $('current').textContent=`${I.toFixed(1)} A`; $('power').textContent=`${this.power_kW.toFixed(1)} kW`;
    $('temp').textContent=`${this.tempC.toFixed(1)} °C`; $('speed').textContent=`${speed_kmh.toFixed(0)} km/h`;
    $('range').textContent=Number.isFinite(range_km)?`${range_km.toFixed(0)} km`:'--';
    $('state').textContent=this.chargerOn?'Charging':(this.power_kW>=0.5?'Driving':'Idle');
    $('cellStats').textContent=`${this.cellCount}s — min ${vmin.toFixed(3)}V / max ${vmax.toFixed(3)}V (Δ ${delta.toFixed(3)}V)`;

    const circumference=2*Math.PI*54, offset=circumference*(1 - clamp(this.soc,0,1));
    $('socRing').style.strokeDasharray=`${circumference}`; $('socRing').style.strokeDashoffset=`${offset}`;

    $('alerts').textContent = alerts.length ? alerts.join(' • ') : 'No alerts.';
    $('alerts').style.background = alerts.length ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.10)';
    $('alerts').style.borderColor = alerts.length ? 'rgba(239,68,68,0.45)' : 'rgba(34,197,94,0.35)';

    charts.addPoint(this._time, { A:{power:this.power_kW,current:I,speed:speed_kmh}, B:{soc:100*this.soc,temp:this.tempC,voltage:this.voltage} });
    if(alertText && (Math.floor(this._time) !== Math.floor(this._time - dt))) log(`ALERT: ${alertText}`);
    this._time += dt;
  }
}

let sim=null, timer=null; const dt=0.2;
function start(){ $('runStatus').textContent='Status: Running'; if(!sim) sim=new EVSim(); if(!timer){ log('Simulation started.'); timer=setInterval(()=>sim.step(dt), dt*1000); $('startBtn').textContent='Pause'; $('startBtn').classList.remove('primary'); } else { clearInterval(timer); timer=null; log('Simulation paused.'); $('runStatus').textContent='Status: Paused'; $('startBtn').textContent='Start'; $('startBtn').classList.add('primary'); } }
function reset(){ if(timer){ clearInterval(timer); timer=null; } sim=new EVSim(); $('startBtn').textContent='Start'; $('startBtn').classList.add('primary'); $('log').innerHTML=''; charts.render(); log('Simulation reset.'); }

function snapshotRowIfEmpty(){ if(!sim) sim=new EVSim(); if(sim.rows.length<=1){ sim.step(0.2); } }

function exportCSV(){ if(!sim) sim=new EVSim(); snapshotRowIfEmpty(); const csv=csvFromRows(sim.rows); safeDownloadCSV('ev-bms-log.csv', csv); }
async function copyCSV(){ if(!sim) sim=new EVSim(); snapshotRowIfEmpty(); const csv=csvFromRows(sim.rows); try { await navigator.clipboard.writeText(csv); log('CSV copied to clipboard.'); alert('CSV copied. Paste into Excel/Sheets.'); } catch{ alert('Clipboard blocked by browser. Try Export CSV.'); } }

window.addEventListener('DOMContentLoaded', ()=>{
  charts.render();
  reset();
  $('startBtn').addEventListener('click', start);
  $('resetBtn').addEventListener('click', reset);
  $('exportBtn').addEventListener('click', exportCSV);
  $('copyBtn').addEventListener('click', copyCSV);
  // Auto-start for real-time feel
  start();
});
