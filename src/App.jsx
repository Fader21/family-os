import { useState, useEffect, useRef } from "react";
import { db } from './firebase';
import { ref, onValue, set } from "firebase/database";
import './App.css';

// ── Constants ────────────────────────────────────────────────
const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const DAYS_SHORT = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const WORKOUT_TYPES = ["ריצה","אופניים","כוח","טאבטה","זומבה","קל","שחייה"];
const SEASONS = ["חורף","אביב","קיץ","סתיו"];
const gid = () => Math.random().toString(36).slice(2,9);
const pad = n => String(n).padStart(2,"0");
const todayKey = () => { const n=new Date(); return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`; };
const addDays = (dk,n) => { const d=new Date(dk+"T12:00:00"); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const weekOf = dk => { const d=new Date(dk+"T12:00:00"); d.setDate(d.getDate()-d.getDay()); const base=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; return Array.from({length:7},(_,i)=>addDays(base,i)); };
const monthOf = dk => { const d=new Date(dk+"T12:00:00"); const y=d.getFullYear(), m=d.getMonth(); const days=[]; for(let i=1;i<=new Date(y,m+1,0).getDate();i++) days.push(`${y}-${pad(m+1)}-${pad(i)}`); return days; };
const fmtDate = dk => { const d=new Date(dk+"T12:00:00"); return `${d.getDate()} ${MONTHS_HE[d.getMonth()]}`; };
const dowOf = dk => new Date(dk+"T12:00:00").getDay();
const fmtTimer = s => `${pad(Math.floor(s/60))}:${pad(s%60)}`;
const addMins = (timeStr, mins) => { if(!timeStr) return ""; const [h,m]=timeStr.split(":").map(Number); const t=h*60+m+mins; return `${pad(Math.floor(t/60)%24)}:${pad(t%60)}`; };
const timeToMins = t => { if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; };

// ── COLOR THEME (Light / Coffee / Green) ──────────────────────
const THEME = {
  bg: "#f4f6f0",        // ירוק בהיר מאוד (כמעט לבן)
  cardBg: "#ffffff",    // לבן נקי לכרטיסים
  text: "#3e2723",      // קפה כהה
  subText: "#795548",   // קפה בהיר יותר
  border: "#d7ccc8",    // מסגרות בצבע בז'
  inputBg: "#efebe9",   // רקע לשדות קלט (אפרפר-חום בהיר)
  shadow: "0 2px 8px rgba(62, 39, 35, 0.1)" // צל עדין בצבע קפה
};

// ── DATA LOGIC ────────────────────────────────────────────────
const SHOE_SOCK_MAP = {"נעלי ספורט":"גרביים לבנות קצרות","נעלי אלגנט":"גרביים ארוכות","בלנסטון":"גרביים ארוכות"};
const SHIFTS = [
  {id:"none",        label:"אין משמרת",             color:"#5d4037", emoji:"—"},
  {id:"morning",     label:"בוקר 07:00–15:00",       color:"#fbc02d", emoji:"🌅"},
  {id:"morning_ext", label:"בוקר+ססיה 07:00–19:00", color:"#d32f2f", emoji:"🔥"},
];

function getMakeupAvailability(shiftId) {
  if (!shiftId || shiftId === "none")    return { makeup: true,  lashes: true,  note: null };
  if (shiftId === "morning")             return { makeup: true,  lashes: true,  note: "⚠️ בוקר בלבד – איפור רק אחה\"צ, ריסים בכל שעה" };
  if (shiftId === "morning_ext")         return { makeup: false, lashes: true,  note: "🔥 ססיה – ריסים בלבד (איפור לא זמין)" };
  return { makeup: true, lashes: true, note: null };
}

function buildAutoTasks(shiftId, travelMin, kidName) {
  if(!shiftId||shiftId==="none") return {today:[],prevDay:[]};
  const t = [{id:gid(),text:`🚌 להביא את ${kidName} לגן (07:00)`,done:false,auto:true,time:"07:00"}];
  if(shiftId==="morning_ext"){
    t.push({id:gid(),text:`🚗 לאסוף את ${kidName} מהגן (~18:30)`,done:false,auto:true,time:"18:30"});
    if(travelMin) t.push({id:gid(),text:`⏰ לצאת מהעבודה ${travelMin} דק׳ לפני האיסוף`,done:false,auto:true,time:""});
  } else {
    t.push({id:gid(),text:`✅ חנה אוספת את ${kidName} (15:00)`,done:false,auto:true,time:"14:45"});
  }
  return {today:t, prevDay:[{id:gid(),text:`👕 להכין בגדים ל${kidName} למחר`,done:false,auto:true}]};
}

// ── Tiny UI Components ──────────────────────────────────────────────────
const Chip = ({label,active,color="#5d4037",onClick,emoji,small}) => (
  <button onClick={onClick} style={{padding:small?"3px 8px":"5px 12px",borderRadius:20,border:`2px solid ${active?color:color+"33"}`,background:active?color:"transparent",color:active?"#fff":color,cursor:"pointer",fontSize:small?11:12,fontWeight:active?700:400,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",transition:"all .15s"}}>
    {emoji&&<span>{emoji}</span>}{label}
  </button>
);
const Tog = ({value,onChange,color="#5d4037",size=20}) => (
  <button onClick={()=>onChange(!value)} style={{width:size*1.8,height:size,borderRadius:size/2,border:"none",cursor:"pointer",background:value?color:"#d7ccc8",position:"relative",transition:"background .2s",flexShrink:0}}>
    <div style={{width:size-4,height:size-4,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:value?size*1.8-size+2:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
  </button>
);
const Inp = ({value,onChange,placeholder,type="text",style={}}) => (
  <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"7px 12px",color:THEME.text,fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",...style}}/>
);

function Confetti({x,y,onDone}) {
  useEffect(()=>{ const t=setTimeout(onDone,900); return ()=>clearTimeout(t); },[]);
  return (
    <div style={{position:"fixed",left:x-30,top:y-30,width:60,height:60,pointerEvents:"none",zIndex:9999}}>
      {["⭐","✨","🎉","💜","🩷"].map((e,i)=>(
        <div key={i} style={{position:"absolute",left:"50%",top:"50%",fontSize:16,animation:`burst${i} 0.8s ease-out forwards`,opacity:0}}>
          <style>{`@keyframes burst${i}{0%{transform:translate(-50%,-50%) scale(0);opacity:1}100%{transform:translate(${Math.cos(i*72*Math.PI/180)*40}px,${Math.sin(i*72*Math.PI/180)*40}px) scale(1);opacity:0}}`}</style>
          {e}
        </div>
      ))}
    </div>
  );
}

function BigCard({emoji,title,subtitle,color,onClick,done,urgent,hidden}) {
  if(hidden) return null;
  const bg = done?THEME.cardBg:urgent?color+"22":color+"11";
  const border = done?THEME.border:urgent?color:color+"44";
  return (
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,border:`2px solid ${border}`,background:bg,cursor:"pointer",marginBottom:8,transition:"all .2s",position:"relative",overflow:"hidden", boxShadow: THEME.shadow}}>
      {urgent&&!done&&<div style={{position:"absolute",top:0,right:0,background:color,color:"#fff",fontSize:10,padding:"2px 8px",borderRadius:"0 16px 0 8px",fontWeight:700}}>דחוף</div>}
      <div style={{width:48,height:48,borderRadius:14,background:done?THEME.inputBg:color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,border:`1px solid ${done?THEME.border:color+"44"}`}}>
        {done?"✅":emoji}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:done?THEME.subText:color,marginBottom:2}}>{title}</div>
        {subtitle&&<div style={{fontSize:12,color:THEME.subText,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{subtitle}</div>}
      </div>
      <div style={{fontSize:18,color:done?THEME.subText:color}}>›</div>
    </div>
  );
}

function Panel({title,color,onClose,children}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column"}}>
      <div onClick={onClose} style={{flex:1,background:"rgba(62, 39, 35, 0.4)"}}/>
      <div style={{background:THEME.bg,borderRadius:"24px 24px 0 0",maxHeight:"88vh",overflow:"auto",padding:"0 0 40px 0", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)"}}>
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,background:THEME.bg,zIndex:1}}>
          <div style={{flex:1,fontSize:16,fontWeight:800,color}}>{title}</div>
          <button onClick={onClose} style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"6px 14px",color:THEME.subText,cursor:"pointer",fontSize:13}}>סגור ✕</button>
        </div>
        <div style={{padding:"16px 20px"}}>{children}</div>
      </div>
    </div>
  );
}

function CR({text,done,onToggle,onDelete,auto,time,color="#388e3c"}) {
  const ref=useRef(null);
  const [conf,setConf]=useState(null);
  const handle=()=>{ if(!done&&ref.current){const r=ref.current.getBoundingClientRect();setConf({x:r.left,y:r.top});} onToggle(); };
  return (
    <>
      {conf&&<Confetti x={conf.x} y={conf.y} onDone={()=>setConf(null)}/>}
      <div ref={ref} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${THEME.border}`}}>
        <button onClick={handle} style={{width:22,height:22,borderRadius:7,border:`2px solid ${done?color:THEME.subText}`,background:done?color:"transparent",cursor:"pointer",flexShrink:0,color:"#fff",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>{done?"✓":""}</button>
        {time&&<span style={{fontSize:10,color:THEME.subText,width:40,flexShrink:0}}>{time}</span>}
        <span style={{flex:1,fontSize:13,color:done?THEME.subText:THEME.text,textDecoration:done?"line-through":"none"}}>
          {auto&&<span style={{fontSize:10,color:"#795548",marginLeft:4}}>⚡</span>}{text}
        </span>
        {!auto&&onDelete&&<button onClick={onDelete} style={{background:"none",border:"none",color:THEME.subText,cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>×</button>}
      </div>
    </>
  );
}

function AddRow({onAdd,placeholder,onAddRec}) {
  const [v,setV]=useState("");
  const go=rec=>{if(v.trim()){rec?onAddRec(v.trim()):onAdd(v.trim());setV("");}};
  return (
    <div style={{display:"flex",gap:6,marginTop:8}}>
      <input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go(false)} placeholder={placeholder}
        style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 12px",color:THEME.text,fontSize:12,outline:"none"}}/>
      <button onClick={()=>go(false)} style={{background:"#5d4037",border:"none",borderRadius:10,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>+</button>
      {onAddRec&&<button onClick={()=>go(true)} title="קבועה" style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"6px 10px",color:THEME.subText,cursor:"pointer",fontSize:11}}>🔁</button>}
    </div>
  );
}

function SmartAlerts({alerts, onDismiss}) {
  if(!alerts||alerts.length===0) return null;
  return (
    <div style={{marginBottom:12}}>
      {alerts.map((a,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:a.level==="warn"?"#fff8e1":"#ffebee",border:`1px solid ${a.level==="warn"?"#ffecb3":"#ffcdd2"}`,marginBottom:6, boxShadow: THEME.shadow}}>
          <span style={{fontSize:16}}>{a.level==="warn"?"⚠️":"❗"}</span>
          <span style={{flex:1,fontSize:12,color:a.level==="warn"?"#f57f17":"#c62828",fontWeight:500}}>{a.text}</span>
          <button onClick={()=>onDismiss(i)} style={{background:"none",border:"none",color:THEME.subText,cursor:"pointer",fontSize:16,padding:0,lineHeight:1}}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── Feature Panels ──────────────────────────────────────────────────────

function ShiftPanel({data,onShiftChange,travelMin,onUpdateTravel,kidName,onClose}) {
  const shift=data?.shift||"none";
  return (
    <Panel title="🏥 משמרת חנה" color="#1976d2" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {SHIFTS.map(s=>(
          <button key={s.id} onClick={()=>{const a=buildAutoTasks(s.id,travelMin,kidName);onShiftChange(s.id,a);}} style={{padding:"14px 16px",borderRadius:14,border:`2px solid ${shift===s.id?s.color:s.color+"33"}`,background:shift===s.id?s.color+"22":"transparent",cursor:"pointer",textAlign:"right",display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
            <span style={{fontSize:24}}>{s.emoji}</span>
            <div style={{flex:1,textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:shift===s.id?s.color:THEME.subText}}>{s.label}</div></div>
            {shift===s.id&&<div style={{fontSize:20,color:s.color}}>✓</div>}
          </button>
        ))}
      </div>
      {shift==="morning_ext"&&(
        <div style={{background:"#ffebee",borderRadius:12,padding:12}}>
          <div style={{fontSize:13,color:"#d32f2f",fontWeight:700,marginBottom:8}}>⚡ משימות אוטומטיות נוצרו למשה</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
            <span style={{fontSize:12,color:THEME.subText}}>⏱ זמן נסיעה:</span>
            <input type="number" value={travelMin||""} onChange={e=>onUpdateTravel(Number(e.target.value))} placeholder="דקות" style={{width:64,background:THEME.cardBg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"4px 8px",color:THEME.text,fontSize:13,outline:"none"}}/>
            <span style={{fontSize:11,color:THEME.subText}}>דקות</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function MakeupPanel({data, onUpdate, shiftId, kidName, onClose}) {
  const clients = data?.clients || [];
  const [editIdx, setEditIdx] = useState(null);
  const avail = getMakeupAvailability(shiftId);
  const blankClient = () => ({ id:gid(), firstName:"", lastName:"", phone:"", type:"makeup", heads:1, atHome:true, address:"", time:"", endTime:"", depositPaid:false });
  const addClient = (type) => {
    const nc = {...blankClient(), type};
    const updated = [...clients, nc];
    onUpdate({...data, clients:updated});
    setEditIdx(updated.length-1);
  };
  const updateClient = (idx, patch) => {
    const updated = clients.map((c,i)=>{
      if(i!==idx) return c;
      const merged = {...c,...patch};
      if((patch.time!==undefined||patch.type!==undefined) && merged.type==="lashes" && merged.time) {
        merged.endTime = addMins(merged.time, 20);
      }
      return merged;
    });
    onUpdate({...data, clients:updated});
  };
  const removeClient = (idx) => { onUpdate({...data, clients:clients.filter((_,i)=>i!==idx)}); if(editIdx===idx) setEditIdx(null); };
  const isPhoneValid = (ph) => (ph||"").replace(/\D/g,"").length === 10;
  const lastEnd = clients.reduce((max, c) => c.endTime && timeToMins(c.endTime) > max ? timeToMins(c.endTime) : max, 0);
  const needsEarlyLeave = lastEnd > timeToMins("15:45");
  return (
    <Panel title="💄 איפור / ריסים" color="#7b1fa2" onClose={onClose}>
      {avail.note && (
        <div style={{background:"#fff8e1",borderRadius:12,padding:12,marginBottom:14,border:"1px solid #ffecb3"}}>
          <div style={{fontSize:13,color:"#fbc02d",fontWeight:600}}>{avail.note}</div>
        </div>
      )}
      {needsEarlyLeave && (
        <div style={{background:"#ffebee",borderRadius:12,padding:10,marginBottom:12,border:"1px solid #ffcdd2",fontSize:12,color:"#ef5350",fontWeight:600}}>
          ⚡ חנה מסיימת אחרי 15:45 → נוצרת משימה למשה לאסוף את {kidName}
        </div>
      )}
      {clients.length===0 && <div style={{textAlign:"center",padding:"20px 0",color:THEME.subText,fontSize:14}}>אין לקוחות להיום</div>}
      {clients.map((c,idx)=>{
        const fullName = [c.firstName,c.lastName].filter(Boolean).join(" ")||"לקוחה ללא שם";
        const phoneBad = c.phone && !isPhoneValid(c.phone);
        const isOpen = editIdx===idx;
        return (
          <div key={c.id} style={{marginBottom:10,borderRadius:14,border:`2px solid ${isOpen?"#7b1fa2":"#e1bee7"}`,background:isOpen?"#f3e5f5":THEME.cardBg,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}} onClick={()=>setEditIdx(isOpen?null:idx)}>
              <span style={{fontSize:20}}>{c.type==="lashes"?"👁️":"💄"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"#7b1fa2"}}>{fullName}</div>
                <div style={{fontSize:11,color:phoneBad?"#d32f2f":THEME.subText}}>
                  {c.phone?(phoneBad?`⚠️ טלפון לא תקין: ${c.phone}`:c.phone):""}{c.time?` • ${c.time}`:""}{c.endTime?`–${c.endTime}`:""}
                </div>
              </div>
              <button onClick={e=>{e.stopPropagation();removeClient(idx);}} style={{background:"#ffebee",border:"none",borderRadius:8,padding:"4px 8px",color:"#d32f2f",cursor:"pointer",fontSize:12}}>מחק</button>
              <span style={{color:"#7b1fa2",fontSize:16}}>{isOpen?"▲":"▼"}</span>
            </div>
            {isOpen&&(
              <div style={{padding:"0 14px 14px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>שם פרטי</div><Inp value={c.firstName} onChange={v=>updateClient(idx,{firstName:v})} placeholder="שם פרטי"/></div>
                  <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>שם משפחה</div><Inp value={c.lastName} onChange={v=>updateClient(idx,{lastName:v})} placeholder="שם משפחה"/></div>
                  <div style={{gridColumn:"1/-1"}}>
                    <div style={{fontSize:10,color:phoneBad?"#d32f2f":THEME.subText,marginBottom:3}}>{phoneBad?"⚠️ מספר חסר – 10 ספרות נדרשות":"📱 טלפון"}</div>
                    <Inp value={c.phone} onChange={v=>updateClient(idx,{phone:v})} placeholder="0501234567" style={{border:`1px solid ${phoneBad?"#d32f2f":THEME.border}`}}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                  {avail.makeup&&<Chip label="💄 איפור" active={c.type==="makeup"} color="#7b1fa2" onClick={()=>updateClient(idx,{type:"makeup"})}/>}
                  {avail.lashes&&<Chip label="👁️ ריסים (20 דק׳)" active={c.type==="lashes"} color="#5c6bc0" onClick={()=>updateClient(idx,{type:"lashes"})}/>}
                </div>
                {c.type==="makeup"&&(
                  <>
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:12,color:THEME.subText,marginBottom:4}}>מס׳ ראשים</div>
                      <div style={{display:"flex",gap:6}}>
                        {[1,2,3,4].map(n=><button key={n} onClick={()=>updateClient(idx,{heads:n})} style={{width:40,height:40,borderRadius:10,border:`2px solid ${c.heads===n?"#7b1fa2":THEME.border}`,background:c.heads===n?"#e1bee7":"transparent",color:c.heads===n?"#7b1fa2":THEME.subText,cursor:"pointer",fontSize:16,fontWeight:700}}>{n}</button>)}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <Chip label="🏠 בבית חנה" active={c.atHome} color="#7b1fa2" onClick={()=>updateClient(idx,{atHome:true,address:""})}/>
                      <Chip label="🚗 בבית הלקוחה" active={!c.atHome} color="#c2185b" onClick={()=>updateClient(idx,{atHome:false})}/>
                    </div>
                    {!c.atHome&&<div style={{marginBottom:8}}><Inp value={c.address} onChange={v=>updateClient(idx,{address:v})} placeholder="כתובת..."/></div>}
                  </>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>🕐 התחלה</div><Inp type="time" value={c.time} onChange={v=>updateClient(idx,{time:v})}/></div>
                  <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>{c.type==="lashes"?"🕐 סיום (אוטו׳)":"🕐 סיום"}</div><Inp type="time" value={c.endTime} onChange={v=>updateClient(idx,{endTime:v})} style={{opacity:c.type==="lashes"?0.6:1}}/></div>
                </div>
                {c.type==="makeup"&&(
                  <div style={{display:"flex",alignItems:"center",gap:10,background:"#e8f5e9",borderRadius:10,padding:"8px 12px"}}>
                    <Tog value={c.depositPaid} onChange={v=>updateClient(idx,{depositPaid:v})} color="#388e3c"/>
                    <span style={{fontSize:13,color:c.depositPaid?"#388e3c":"#d32f2f",fontWeight:600}}>{c.depositPaid?"✓ מקדמה שולמה":"✗ מקדמה חסרה"}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        {avail.makeup&&<button onClick={()=>addClient("makeup")} style={{flex:1,background:"#f3e5f5",border:"2px dashed #ce93d8",borderRadius:12,padding:"10px",color:"#7b1fa2",cursor:"pointer",fontWeight:700,fontSize:13}}>+ איפור</button>}
        {avail.lashes&&<button onClick={()=>addClient("lashes")} style={{flex:1,background:"#e8eaf6",border:"2px dashed #9fa8da",borderRadius:12,padding:"10px",color:"#5c6bc0",cursor:"pointer",fontWeight:700,fontSize:13}}>+ ריסים</button>}
      </div>
      {clients.length>0&&(
        <div style={{marginTop:14,padding:"12px 14px",background:THEME.cardBg,borderRadius:12, border: `1px solid ${THEME.border}`}}>
          <div style={{fontSize:11,color:THEME.subText,marginBottom:3}}>סה״כ היום</div>
          <div style={{fontSize:20,fontWeight:800,color:"#7b1fa2"}}>
            {clients.reduce((s,c)=>{
              if(c.type==="lashes") return s+90;
              const base=350, extra=Math.max(0,(c.heads||1)-1)*150, travel=c.atHome?0:150;
              return s+base+extra+travel;
            },0).toLocaleString()} ₪
          </div>
        </div>
      )}
    </Panel>
  );
}

const DEFAULT_CATS = {
  moshe: ["חולצות","מכנסיים","גרביים","נעליים","ג'קטים","אביזרים"],
  hana:  ["חולצות","מכנסיים","שמלות","חצאיות","ג'קטים","נעליים","גרביים","חזיות","אביזרים"],
  uri:   ["חולצות","מכנסיים","גרביים","נעליים","מעיל"],
};

function OutfitPanel({wardrobeM,wardrobeH,wardrobeU,catsM,catsH,catsU,dataM,dataH,dataU,onM,onH,onU,onWM,onWH,onWU,onCM,onCH,onCU,season,onClose}) {
  const [tab,setTab]=useState("moshe");
  const [wardrobeMode,setWardrobeMode]=useState(false);
  const [editCats,setEditCats]=useState(false);
  const [newCat,setNewCat]=useState("");
  const PEOPLE=[
    {key:"moshe",label:"💜 משה",color:"#512da8",data:dataM,set:onM,ward:wardrobeM,setW:onWM,cats:catsM||DEFAULT_CATS.moshe,setCats:onCM},
    {key:"hana", label:"🩷 חנה", color:"#c2185b",data:dataH,set:onH,ward:wardrobeH,setW:onWH,cats:catsH||DEFAULT_CATS.hana, setCats:onCH},
    {key:"uri",  label:"👦 אורי",color:"#0288d1",data:dataU,set:onU,ward:wardrobeU,setW:onWU,cats:catsU||DEFAULT_CATS.uri,  setCats:onCU},
  ];
  const cur=PEOPLE.find(p=>p.key===tab);
  const suggest=()=>{
    const s={};
    cur.cats.forEach(cat=>{
      if(cat==="גרביים") return;
      const a=cur.ward[cat]||[];
      if(a.length) s[cat]=a[Math.floor(Math.random()*a.length)];
    });
    const shoe=s["נעליים"];
    if(shoe&&SHOE_SOCK_MAP[shoe]) s["גרביים"]=SHOE_SOCK_MAP[shoe];
    else { const socks=cur.ward["גרביים"]||[]; if(socks.length) s["גרביים"]=socks[Math.floor(Math.random()*socks.length)]; }
    cur.set({...cur.data,suggested:s,confirmed:false});
  };
  const handleFieldChange=(cat,val)=>{
    const newSug={...cur.data?.suggested,[cat]:val};
    if(cat==="נעליים"&&SHOE_SOCK_MAP[val]) newSug["גרביים"]=SHOE_SOCK_MAP[val];
    cur.set({...cur.data,suggested:newSug});
  };
  const renameCat=(oldName,newName)=>{
    if(!newName.trim()||oldName===newName.trim()) return;
    const cats=cur.cats.map(c=>c===oldName?newName.trim():c);
    const ward={...cur.ward};
    if(ward[oldName]) { ward[newName.trim()]=ward[oldName]; delete ward[oldName]; }
    cur.setCats(cats); cur.setW(ward);
  };
  const deleteCat=(cat)=>{
    const cats=cur.cats.filter(c=>c!==cat);
    const ward={...cur.ward};
    delete ward[cat];
    cur.setCats(cats); cur.setW(ward);
  };
  return (
    <Panel title="👗 לבוש" color="#c2185b" onClose={onClose}>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {PEOPLE.map(p=><Chip key={p.key} label={p.label} active={tab===p.key} color={p.color} onClick={()=>setTab(p.key)}/>)}
        <Chip label={wardrobeMode?"← חזרה":"🗂️ ארון"} active={wardrobeMode} color="#6B7280" onClick={()=>{setWardrobeMode(w=>!w);setEditCats(false);}}/>
      </div>
      {!wardrobeMode?(
        <>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {SEASONS.map(s=><div key={s} style={{padding:"3px 10px",borderRadius:10,background:season===s?"#5d4037":"transparent",border:`1px solid ${THEME.border}`,fontSize:12,color:season===s?"#fff":THEME.subText}}>{s}</div>)}
          </div>
          <button onClick={suggest} style={{width:"100%",background:`linear-gradient(135deg,${cur.color}33,${cur.color}11)`,border:`2px dashed ${cur.color}55`,borderRadius:14,padding:"12px",color:cur.color,cursor:"pointer",fontWeight:700,fontSize:14,marginBottom:14}}>
            ✨ הצע קומבינציה
          </button>
          {Object.keys(cur.data?.suggested||{}).length>0&&(
            <>
              {cur.cats.map(cat=>{
                const opts=cur.ward[cat]||[], val=cur.data?.suggested?.[cat]||"";
                const isAutoSock=cat==="גרביים"&&SHOE_SOCK_MAP[cur.data?.suggested?.["נעליים"]];
                return (
                  <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:80,fontSize:11,color:THEME.subText,flexShrink:0}}>{cat}{isAutoSock&&<span style={{color:"#5c6bc0",fontSize:9}}> ⚡</span>}</div>
                    {opts.length?(
                      <select value={val} onChange={e=>handleFieldChange(cat,e.target.value)} style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 10px",color:THEME.text,fontSize:12,outline:"none"}}>
                        <option value="">—</option>{opts.map((o,i)=><option key={i} value={o}>{o}</option>)}
                      </select>
                    ):(
                      <input value={val} onChange={e=>handleFieldChange(cat,e.target.value)} style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 10px",color:THEME.text,fontSize:12,outline:"none"}}/>
                    )}
                  </div>
                );
              })}
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,padding:"10px 12px",background:cur.data?.confirmed?cur.color+"22":THEME.inputBg,borderRadius:12}}>
                <Tog value={cur.data?.confirmed} onChange={v=>cur.set({...cur.data,confirmed:v})} color={cur.color}/>
                <span style={{fontSize:13,color:cur.data?.confirmed?cur.color:THEME.subText,fontWeight:cur.data?.confirmed?700:400}}>{cur.data?.confirmed?"✅ תלבושת אושרה!":"לאשר תלבושת"}</span>
              </div>
            </>
          )}
        </>
      ):(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,color:cur.color,fontWeight:700}}>קטגוריות {cur.label}</div>
            <button onClick={()=>setEditCats(e=>!e)} style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"5px 12px",color:THEME.subText,cursor:"pointer",fontSize:12}}>{editCats?"✓ סיום":"✏️ ערוך קטגוריות"}</button>
          </div>
          {editCats?(
            <>
              {cur.cats.map(cat=>(
                <div key={cat} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                  <input defaultValue={cat} onBlur={e=>renameCat(cat,e.target.value)} style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 12px",color:THEME.text,fontSize:13,outline:"none"}}/>
                  <button onClick={()=>deleteCat(cat)} style={{background:"#ffebee",border:"none",borderRadius:8,padding:"5px 10px",color:"#d32f2f",cursor:"pointer",fontSize:13}}>×</button>
                </div>
              ))}
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="+ קטגוריה חדשה..." style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 12px",color:THEME.text,fontSize:12,outline:"none"}}/>
                <button onClick={()=>{if(newCat.trim()){cur.setCats([...cur.cats,newCat.trim()]);setNewCat("");}}} style={{background:cur.color,border:"none",borderRadius:10,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>+</button>
              </div>
            </>
          ):(
            cur.cats.map(cat=>(
              <div key={cat} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:cur.color,fontWeight:700,marginBottom:6}}>{cat}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
                  {(cur.ward[cat]||[]).map((item,i)=>(
                    <div key={i} style={{background:THEME.inputBg,borderRadius:8,padding:"4px 12px",fontSize:12,color:THEME.subText,display:"flex",alignItems:"center",gap:6}}>
                      {item}<button onClick={()=>{const w={...cur.ward};w[cat]=w[cat].filter((_,j)=>j!==i);cur.setW(w);}} style={{background:"none",border:"none",color:"#5d4037",cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>×</button>
                    </div>
                  ))}
                </div>
                <AddRow placeholder={`+ ${cat}`} onAdd={t=>{const w={...cur.ward};w[cat]=[...(w[cat]||[]),t];cur.setW(w);}}/>
              </div>
            ))
          )}
        </>
      )}
    </Panel>
  );
}

function MealsPanel({data,templates,onUpdate,onUpdateTpl,onClose}) {
  const [newTpl,setNewTpl]=useState("");
  const d=data||{};
  const set=(k,v)=>onUpdate({...d,[k]:v});
  const MEALS=[
    {k:"breakfast",l:"🌅 ארוחת בוקר"},
    {k:"lunch",    l:"☀️ ארוחת צהריים"},
    {k:"snack",    l:"🍎 ביניים"},
    {k:"dinner",   l:"🌙 ארוחת ערב"},
  ];
  const getMeal=(k) => d[k]||{main:"",extras:[],dessert:""};
  const setMeal=(k,v) => set(k,v);
  const addExtra=(k) => { const m=getMeal(k); setMeal(k,{...m,extras:[...(m.extras||[]),""]}) };
  const setExtra=(k,i,v) => { const m=getMeal(k); const ex=[...(m.extras||[])]; ex[i]=v; setMeal(k,{...m,extras:ex}); };
  const removeExtra=(k,i) => { const m=getMeal(k); setMeal(k,{...m,extras:(m.extras||[]).filter((_,j)=>j!==i)}); };
  return (
    <Panel title="🍽️ ארוחות" color="#388e3c" onClose={onClose}>
      {MEALS.map(({k,l})=>{
        const meal=getMeal(k);
        return (
          <div key={k} style={{marginBottom:12,padding:"12px 14px",background:THEME.cardBg,borderRadius:14,border:`1px solid ${THEME.border}`, boxShadow: THEME.shadow}}>
            <div style={{fontSize:12,color:"#388e3c",fontWeight:700,marginBottom:8}}>{l}</div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input value={meal.main} onChange={e=>setMeal(k,{...meal,main:e.target.value})} placeholder="מנה עיקרית..."
                style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 12px",color:THEME.text,fontSize:13,outline:"none"}}/>
              {templates.length>0&&(
                <select onChange={e=>e.target.value&&setMeal(k,{...meal,main:e.target.value})} value="" style={{background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"0 8px",color:THEME.subText,fontSize:12,cursor:"pointer",flexShrink:0,outline:"none"}}>
                  <option value="">📋</option>{templates.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              )}
            </div>
            {(meal.extras||[]).map((ex,i)=>(
              <div key={i} style={{display:"flex",gap:4,marginBottom:4}}>
                <div style={{width:3,background:"#388e3c44",borderRadius:2,flexShrink:0}}/>
                <input value={ex} onChange={e=>setExtra(k,i,e.target.value)} placeholder={`תוספת ${i+1}...`}
                  style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"5px 10px",color:THEME.text,fontSize:12,outline:"none"}}/>
                <button onClick={()=>removeExtra(k,i)} style={{background:"none",border:"none",color:THEME.subText,cursor:"pointer",fontSize:14,padding:0}}>×</button>
              </div>
            ))}
            {meal.dessert!==undefined&&(
              <div style={{display:"flex",gap:4,marginBottom:4}}>
                <div style={{width:3,background:"#fbc02d44",borderRadius:2,flexShrink:0}}/>
                <input value={meal.dessert||""} onChange={e=>setMeal(k,{...meal,dessert:e.target.value})} placeholder="🍰 קינוח..."
                  style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"5px 10px",color:THEME.text,fontSize:12,outline:"none"}}/>
                {meal.dessert&&<button onClick={()=>setMeal(k,{...meal,dessert:""})} style={{background:"none",border:"none",color:THEME.subText,cursor:"pointer",fontSize:14,padding:0}}>×</button>}
              </div>
            )}
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <button onClick={()=>addExtra(k)} style={{background:"#e8f5e9",border:"1px solid #c8e6c9",borderRadius:8,padding:"3px 10px",color:"#388e3c",cursor:"pointer",fontSize:11}}>+ תוספת</button>
              {!meal.dessert&&<button onClick={()=>setMeal(k,{...meal,dessert:""})} style={{background:"#fffde7",border:"1px solid #fff9c4",borderRadius:8,padding:"3px 10px",color:"#fbc02d",cursor:"pointer",fontSize:11}}>+ קינוח</button>}
            </div>
          </div>
        );
      })}
      <div style={{borderTop:`1px solid ${THEME.border}`,paddingTop:12,marginTop:4}}>
        <div style={{fontSize:12,color:THEME.subText,marginBottom:8}}>📋 תבניות</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
          {templates.map(t=>(
            <div key={t.id} style={{background:THEME.inputBg,borderRadius:8,padding:"4px 12px",fontSize:12,color:THEME.subText,display:"flex",alignItems:"center",gap:6}}>
              {t.name}<button onClick={()=>onUpdateTpl(templates.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:THEME.subText,cursor:"pointer",fontSize:12,padding:0}}>×</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:6}}>
          <input value={newTpl} onChange={e=>setNewTpl(e.target.value)} placeholder="+ תבנית חדשה..." style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 12px",color:THEME.text,fontSize:12,outline:"none"}}/>
          <button onClick={()=>{if(newTpl.trim()){onUpdateTpl([...templates,{id:gid(),name:newTpl.trim()}]);setNewTpl("");}}} style={{background:"#388e3c",border:"none",borderRadius:10,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>+</button>
        </div>
      </div>
    </Panel>
  );
}

function WorkoutPanel({data,onUpdate,wardrobeM,wardrobeH,onClose}) {
  const d=data||{couple:false,moshe:{active:false,type:"",time:"",gear:{}},hana:{active:false,type:"",time:"",gear:{}}};
  const set=(p,k,v)=>onUpdate({...d,[p]:{...d[p],[k]:v}});
  const P=[
    {key:"moshe",label:"🏋️ משה",color:"#512da8",ward:wardrobeM,gearCats:["חולצות","מכנסיים","גרביים","נעליים"]},
    {key:"hana", label:"🏃 חנה", color:"#c2185b",ward:wardrobeH,gearCats:["חולצות","מכנסיים","גרביים","נעליים","חזיות"]},
  ];
  return (
    <Panel title="🏋️ אימונים" color="#f57c00" onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"12px 14px",background:"#fff3e0",borderRadius:12}}>
        <Tog value={d.couple} onChange={v=>onUpdate({...d,couple:v})} color="#f57c00"/>
        <span style={{fontSize:14,fontWeight:600,color:d.couple?"#f57c00":THEME.subText}}>🤝 אימון זוגי</span>
      </div>
      {(d.couple?[P[0]]:P).map(({key,label,color,ward,gearCats})=>(
        <div key={key} style={{marginBottom:14,padding:12,background:THEME.cardBg,borderRadius:14, border:`1px solid ${THEME.border}`, boxShadow: THEME.shadow}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <Tog value={d[key].active} onChange={v=>set(key,"active",v)} color={color}/>
            <span style={{fontSize:14,fontWeight:700,color}}>{d.couple?"🤝 אימון זוגי":label}</span>
          </div>
          {d[key].active&&(
            <>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {WORKOUT_TYPES.map(t=><Chip key={t} label={t} active={d[key].type===t} color={color} onClick={()=>set(key,"type",t)}/>)}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:12,color:THEME.subText}}>⏰</span>
                <input type="time" value={d[key].time||""} onChange={e=>set(key,"time",e.target.value)} style={{background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 10px",color:THEME.text,fontSize:13,outline:"none"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {gearCats.map(cat=>(
                  <div key={cat}>
                    <div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>{cat}</div>
                    <select value={d[key].gear?.[cat]||""} onChange={e=>set(key,"gear",{...d[key].gear,[cat]:e.target.value})} style={{width:"100%",background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"4px 8px",color:THEME.text,fontSize:11,outline:"none"}}>
                      <option value="">—</option>{(ward[cat]||[]).map((o,i)=><option key={i} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </Panel>
  );
}

function TasksPanel({mT,hT,recM,recH,onMT,onHT,onRM,onRH,names,onClose}) {
  const [tab,setTab]=useState("moshe");
  const items=tab==="moshe"?[...(recM||[]).map(i=>({...i,_rec:true})),...(mT||[])]: [...(recH||[]).map(i=>({...i,_rec:true})),...(hT||[])];
  const done=items.filter(t=>t.done).length;
  const tog=(id,isRec)=>{ if(tab==="moshe"){isRec?onRM((recM||[]).map(x=>x.id===id?{...x,done:!x.done}:x)):onMT((mT||[]).map(x=>x.id===id?{...x,done:!x.done}:x));} else{isRec?onRH((recH||[]).map(x=>x.id===id?{...x,done:!x.done}:x)):onHT((hT||[]).map(x=>x.id===id?{...x,done:!x.done}:x));} };
  const del=(id,isRec)=>{ if(tab==="moshe"){isRec?onRM((recM||[]).filter(x=>x.id!==id)):onMT((mT||[]).filter(x=>x.id!==id));} else{isRec?onRH((recH||[]).filter(x=>x.id!==id)):onHT((hT||[]).filter(x=>x.id!==id));} };
  return (
    <Panel title="✅ משימות" color="#5d4037" onClose={onClose}>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <Chip label={`💜 ${names.A}`} active={tab==="moshe"} color="#512da8" onClick={()=>setTab("moshe")}/>
        <Chip label={`🩷 ${names.B}`} active={tab==="hana"} color="#c2185b" onClick={()=>setTab("hana")}/>
        <span style={{marginRight:"auto",fontSize:12,color:THEME.subText,alignSelf:"center"}}>{done}/{items.length}</span>
      </div>
      {items.map(t=><CR key={t.id} text={t.text} done={t.done} auto={t.auto} time={t.time} color={tab==="moshe"?"#512da8":"#c2185b"} onToggle={()=>tog(t.id,t._rec)} onDelete={()=>del(t.id,t._rec)}/>)}
      <AddRow placeholder={`+ משימה ל${tab==="moshe"?names.A:names.B}...`}
        onAdd={v=>tab==="moshe"?onMT([...(mT||[]),{id:gid(),text:v,done:false}]):onHT([...(hT||[]),{id:gid(),text:v,done:false}])}
        onAddRec={v=>tab==="moshe"?onRM([...(recM||[]),{id:gid(),text:v,done:false}]):onRH([...(recH||[]),{id:gid(),text:v,done:false}])}/>
    </Panel>
  );
}

function CleaningPanel({data,allWeekData,selectedDate,onUpdate,recurring,onUpdateRec,onClose}) {
  const d=data||{scheduled:false,couple:false,items:[]};
  const rec=recurring||[];
  const wk=weekOf(selectedDate);
  const otherDay=wk.find(dk=>dk!==selectedDate&&allWeekData[dk]?.cleaning?.scheduled);
  const allItems=[...rec.map(i=>({...i,_rec:true})),...(d.items||[])];
  return (
    <Panel title="🧹 ניקיון שבועי" color="#fbc02d" onClose={onClose}>
      {otherDay&&!d.scheduled&&<div style={{background:"#fff9c4",borderRadius:12,padding:12,marginBottom:12,fontSize:13,color:"#fbc02d"}}>📅 ניקיון מתוכנן ליום {DAYS_HE[dowOf(otherDay)]}</div>}
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff9c4",borderRadius:12}}>
          <Tog value={d.scheduled} onChange={v=>onUpdate({...d,scheduled:v})} color="#fbc02d"/>
          <span style={{fontSize:13,color:d.scheduled?"#fbc02d":THEME.subText}}>ביום זה</span>
        </div>
        {d.scheduled&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff9c4",borderRadius:12}}>
          <Tog value={d.couple} onChange={v=>onUpdate({...d,couple:v})} color="#fbc02d"/>
          <span style={{fontSize:13,color:d.couple?"#fbc02d":THEME.subText}}>👫 ביחד</span>
        </div>}
      </div>
      {d.scheduled&&(
        <>
          {allItems.map(i=><CR key={i.id} text={i.text} done={i.done} color="#fbc02d" onToggle={()=>i._rec?onUpdateRec(rec.map(x=>x.id===i.id?{...x,done:!x.done}:x)):onUpdate({...d,items:(d.items||[]).map(x=>x.id===i.id?{...x,done:!x.done}:x)})} onDelete={()=>i._rec?onUpdateRec(rec.filter(x=>x.id!==i.id)):onUpdate({...d,items:(d.items||[]).filter(x=>x.id!==i.id)})}/>)}
          <AddRow placeholder="+ משימת ניקיון..." onAdd={v=>onUpdate({...d,items:[...(d.items||[]),{id:gid(),text:v,done:false}]})} onAddRec={v=>onUpdateRec([...rec,{id:gid(),text:v,done:false}])}/>
        </>
      )}
    </Panel>
  );
}

function ShoppingPanel({data,onUpdate,recurring,onUpdateRec,usageData,onUpdateUsage,onClose}) {
  const d=data||{scheduled:false,couple:false,items:[]};
  const rec=recurring||[];
  const [newP,setNewP]=useState(""),newF=useRef(2);
  const allItems=[...rec.map(i=>({...i,_rec:true})),...(d.items||[])];
  const now = Date.now();
  const suggestions=Object.entries(usageData||{}).filter(([,v])=>{
    if(!v.lastBought) return true;
    const daysSince=(now-v.lastBought)/864e5;
    return daysSince>=v.freqWeeks*7;
  }).map(([k,v])=>({name:k,...v}));
  return (
    <Panel title="🛒 קניות" color="#0288d1" onClose={onClose}>
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#e1f5fe",borderRadius:12}}>
          <Tog value={d.scheduled} onChange={v=>onUpdate({...d,scheduled:v})} color="#0288d1"/>
          <span style={{fontSize:13,color:d.scheduled?"#0288d1":THEME.subText}}>קניות היום</span>
        </div>
        {d.scheduled&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#e1f5fe",borderRadius:12}}>
          <Tog value={d.couple} onChange={v=>onUpdate({...d,couple:v})} color="#0288d1"/>
          <span style={{fontSize:13,color:d.couple?"#0288d1":THEME.subText}}>👫 ביחד</span>
        </div>}
      </div>
      {suggestions.length>0&&(
        <div style={{background:"#e1f5fe",borderRadius:12,padding:12,marginBottom:12}}>
          <div style={{fontSize:12,color:"#0288d1",fontWeight:700,marginBottom:8}}>💡 הגיע הזמן לקנות:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {suggestions.map(s=><button key={s.name} onClick={()=>onUpdate({...d,items:[...(d.items||[]),{id:gid(),text:s.name,done:false}]})}
              style={{background:"#b3e5fc",border:"1px solid #81d4fa",borderRadius:10,padding:"4px 12px",color:"#0288d1",cursor:"pointer",fontSize:12}}>+ {s.name}</button>)}
          </div>
        </div>
      )}
      {allItems.map(i=><CR key={i.id} text={i.text} done={i.done} color="#0288d1"
        onToggle={()=>i._rec?onUpdateRec(rec.map(x=>x.id===i.id?{...x,done:!x.done}:x)):onUpdate({...d,items:(d.items||[]).map(x=>x.id===i.id?{...x,done:!x.done}:x)})}
        onDelete={()=>i._rec?onUpdateRec(rec.filter(x=>x.id!==i.id)):onUpdate({...d,items:(d.items||[]).filter(x=>x.id!==i.id)})}/>)}
      <AddRow placeholder="+ מוצר..." onAdd={v=>onUpdate({...d,items:[...(d.items||[]),{id:gid(),text:v,done:false}]})} onAddRec={v=>onUpdateRec([...rec,{id:gid(),text:v,done:false}])}/>
      <div style={{borderTop:`1px solid ${THEME.border}`,paddingTop:12,marginTop:12}}>
        <div style={{fontSize:12,color:THEME.subText,marginBottom:8}}>📊 מוצרים חוזרים</div>
        {Object.entries(usageData||{}).map(([k,v])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"6px 10px",background:THEME.inputBg,borderRadius:10}}>
            <span style={{flex:1,fontSize:12}}>{k}</span>
            <span style={{fontSize:11,color:THEME.subText}}>כל {v.freqWeeks} שב׳</span>
            <button onClick={()=>onUpdateUsage({...usageData,[k]:{...v,lastBought:Date.now()}})} style={{background:"#388e3c",border:"none",borderRadius:8,padding:"3px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>קניתי ✓</button>
            <button onClick={()=>{const u={...usageData};delete u[k];onUpdateUsage(u);}} style={{background:"none",border:"none",color:THEME.subText,cursor:"pointer",fontSize:14,padding:0}}>×</button>
          </div>
        ))}
        <div style={{display:"flex",gap:6,marginTop:8}}>
          <input value={newP} onChange={e=>setNewP(e.target.value)} placeholder="מוצר חוזר..." style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 12px",color:THEME.text,fontSize:12,outline:"none"}}/>
          <input type="number" min={1} max={12} defaultValue={2} onChange={e=>newF.current=Number(e.target.value)} style={{width:48,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px",color:THEME.text,fontSize:12,textAlign:"center",outline:"none"}}/>
          <span style={{fontSize:11,color:THEME.subText,alignSelf:"center"}}>שב׳</span>
          <button onClick={()=>{if(newP.trim()){onUpdateUsage({...usageData,[newP.trim()]:{freqWeeks:newF.current,lastBought:0}});setNewP("");}}} style={{background:"#0288d1",border:"none",borderRadius:10,padding:"6px 12px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>+</button>
        </div>
      </div>
    </Panel>
  );
}

function WinnerPanel({data, onUpdate, who, name, onClose}) {
  const [editMode,setEditMode]=useState(false);
  const [editChecks,setEditChecks]=useState(false);
  const timerRef=useRef(null);
  const DEFAULT_Q = who==="moshe"?[
    {id:"q1",prompt:"📅 3 דברים שקרו לי / עשיתי היום:",type:"text3"},
    {id:"q2",prompt:"🙏 5 דברים שאני מכיר תודה עליהם:",type:"text5"},
    {id:"q3",prompt:"💑 מה עשיתי לטובת הזוגיות שלי?",type:"text"},
    {id:"q4",prompt:"👨‍👧‍👦 מה עשיתי לטובת היחסים עם הילדים?",type:"text"},
    {id:"q5",prompt:"💼 מה עשיתי לטובת היחסים העסקיים שלי?",type:"text"},
  ]:[
    {id:"q1",prompt:"💖 מה היה טוב היום?",type:"text"},
    {id:"q2",prompt:"🙏 3 דברים שאני מכירה תודה עליהם:",type:"text3"},
    {id:"q3",prompt:"💑 מה עשיתי לטובת הזוגיות שלנו?",type:"text"},
  ];
  const DEFAULT_CHECKS = [
    {id:"phoneOff",label:"📵 ניתוק טלפון"},
    {id:"bookRead",label:"📖 קראתי (זמן אמיתי)"},
  ];
  const d = data || {questions:[],answers:{},checkboxes:[],alarmTime:"",bookName:"",readFrom:"",readTo:"",readTimer:0,timerRunning:false};
  const questions = d.questions?.length ? d.questions : DEFAULT_Q;
  const checkboxes = d.checkboxes?.length ? d.checkboxes : DEFAULT_CHECKS;
  const set=(k,v)=>onUpdate(p=>({...(p||{}),[k]:v}));
  const setA=(k,v)=>onUpdate(p=>({...(p||{}),answers:{...((p||{}).answers||{}),[k]:v}}));
  const setQ=(qs)=>onUpdate(p=>({...(p||{}),questions:qs}));
  const setChecks=(cb)=>onUpdate(p=>({...(p||{}),checkboxes:cb}));
  const toggleCheck=(id)=>onUpdate(p=>({...(p||{}),[id]:!(p||{})[id]}));
  useEffect(()=>{
    if(d.timerRunning){ timerRef.current=setInterval(()=>onUpdate(p=>({...(p||{}),readTimer:((p||{}).readTimer||0)+1})),1000); }
    else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  },[d.timerRunning]);
  const readTimerMin = Math.floor((d.readTimer||0)/60);
  return (
    <Panel title={`🏆 קוד המנצח – ${name}`} color="#fbc02d" onClose={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:12,color:THEME.subText}}>הטקס האישי שלך לפני שינה</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setEditChecks(e=>!e)} style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"5px 10px",color:THEME.subText,cursor:"pointer",fontSize:11}}>✏️ צ'קים</button>
          <button onClick={()=>setEditMode(e=>!e)} style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"5px 12px",color:THEME.subText,cursor:"pointer",fontSize:12}}>{editMode?"✓ סיום":"✏️ שאלות"}</button>
        </div>
      </div>
      {editMode?(
        <div>
          {questions.map((q,i)=>(
            <div key={q.id} style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
              <input value={q.prompt} onChange={e=>{const qs=[...questions];qs[i]={...qs[i],prompt:e.target.value};setQ(qs);}} style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 12px",color:THEME.text,fontSize:12,outline:"none"}}/>
              <select value={q.type} onChange={e=>{const qs=[...questions];qs[i]={...qs[i],type:e.target.value};setQ(qs);}} style={{background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"5px",color:THEME.subText,fontSize:11,outline:"none"}}>
                <option value="text">טקסט</option><option value="text3">3 שורות</option><option value="text5">5 שורות</option>
              </select>
              <button onClick={()=>setQ(questions.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#d32f2f",cursor:"pointer",fontSize:18,padding:0}}>×</button>
            </div>
          ))}
          <button onClick={()=>setQ([...questions,{id:gid(),prompt:"שאלה חדשה...",type:"text"}])} style={{background:"#fff9c4",border:"1px dashed #fbc02d",borderRadius:10,padding:"8px 14px",color:"#fbc02d",cursor:"pointer",fontSize:12,marginTop:4,width:"100%"}}>+ הוסף שאלה</button>
        </div>
      ):(
        <>
          {questions.map(q=>(
            <div key={q.id} style={{marginBottom:14}}>
              <div style={{fontSize:13,color:"#fbc02d",fontWeight:600,marginBottom:6}}>{q.prompt}</div>
              {q.type==="text3"&&[1,2,3].map(i=><input key={i} value={d.answers?.[q.id+"_"+i]||""} onChange={e=>setA(q.id+"_"+i,e.target.value)} placeholder={`${i}.`} style={{display:"block",width:"100%",marginBottom:4,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"7px 12px",color:THEME.text,fontSize:13,boxSizing:"border-box",outline:"none"}}/>)}
              {q.type==="text5"&&[1,2,3,4,5].map(i=><input key={i} value={d.answers?.[q.id+"_"+i]||""} onChange={e=>setA(q.id+"_"+i,e.target.value)} placeholder={`${i}.`} style={{display:"block",width:"100%",marginBottom:4,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"7px 12px",color:THEME.text,fontSize:13,boxSizing:"border-box",outline:"none"}}/>)}
              {q.type==="text"&&<textarea value={d.answers?.[q.id]||""} onChange={e=>setA(q.id,e.target.value)} placeholder="..." style={{width:"100%",background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"8px 12px",color:THEME.text,fontSize:12,minHeight:56,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>}
            </div>
          ))}
          <div style={{background:THEME.cardBg,borderRadius:14,padding:14,marginBottom:14, border:`1px solid ${THEME.border}`, boxShadow: THEME.shadow}}>
            <div style={{fontSize:13,color:"#fbc02d",fontWeight:700,marginBottom:10}}>📖 מעקב קריאה</div>
            <input value={d.bookName||""} onChange={e=>set("bookName",e.target.value)} placeholder="שם הספר..." style={{width:"100%",marginBottom:8,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"7px 12px",color:THEME.text,fontSize:13,boxSizing:"border-box",outline:"none"}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>מעמוד</div><input type="number" value={d.readFrom||""} onChange={e=>set("readFrom",e.target.value)} style={{width:"100%",background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"7px 12px",color:THEME.text,fontSize:13,boxSizing:"border-box",outline:"none"}}/></div>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>עד עמוד</div><input type="number" value={d.readTo||""} onChange={e=>set("readTo",e.target.value)} style={{width:"100%",background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"7px 12px",color:THEME.text,fontSize:13,boxSizing:"border-box",outline:"none"}}/></div>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>עמודים</div><div style={{padding:"8px 4px",fontSize:16,color:"#388e3c",fontWeight:800,textAlign:"center"}}>{d.readTo&&d.readFrom?Math.max(0,Number(d.readTo)-Number(d.readFrom)):0}</div></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:20,fontWeight:800,color:"#fbc02d",fontVariantNumeric:"tabular-nums",minWidth:56}}>{fmtTimer(d.readTimer||0)}</div>
              <button onClick={()=>set("timerRunning",!d.timerRunning)} style={{background:d.timerRunning?"#ef5350":"#388e3c",border:"none",borderRadius:10,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>{d.timerRunning?"⏸ עצור":"▶ התחל"}</button>
              <button onClick={()=>set("readTimer",0)} style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"6px 12px",color:THEME.subText,cursor:"pointer",fontSize:13}}>↺</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:13,color:"#fbc02d"}}>⏰ שעון מעורר:</span>
            <input type="time" value={d.alarmTime||""} onChange={e=>set("alarmTime",e.target.value)} style={{background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 10px",color:THEME.text,fontSize:14,outline:"none"}}/>
          </div>
          {editChecks ? (
            <div style={{background:THEME.cardBg,borderRadius:12,padding:12,marginBottom:8, border:`1px solid ${THEME.border}`}}>
              <div style={{fontSize:12,color:THEME.subText,marginBottom:8}}>✏️ עריכת צ׳ק-בוקסים</div>
              {checkboxes.map((cb,i)=>(
                <div key={cb.id} style={{display:"flex",gap:6,marginBottom:6}}>
                  <input value={cb.label} onChange={e=>{const c=[...checkboxes];c[i]={...c[i],label:e.target.value};setChecks(c);}} style={{flex:1,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"5px 12px",color:THEME.text,fontSize:12,outline:"none"}}/>
                  <button onClick={()=>setChecks(checkboxes.filter((_,j)=>j!==i))} style={{background:"#ffebee",border:"none",borderRadius:8,padding:"4px 8px",color:"#ef5350",cursor:"pointer",fontSize:13}}>×</button>
                </div>
              ))}
              <button onClick={()=>setChecks([...checkboxes,{id:gid(),label:"פעולה חדשה"}])} style={{background:"#fff9c4",border:"1px dashed #fbc02d",borderRadius:10,padding:"6px",color:"#fbc02d",cursor:"pointer",fontSize:12,width:"100%",marginTop:4}}>+ הוסף</button>
            </div>
          ):(
            checkboxes.map(cb=>{
              const checked = d[cb.id]||false;
              const isReadTimer = cb.id==="bookRead";
              const displayLabel = isReadTimer&&readTimerMin>0&&checked ? `📖 קראתי ${readTimerMin} דקות` : cb.label;
              return (
                <div key={cb.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,padding:"10px 14px",background:checked?"#fff9c4":THEME.cardBg,borderRadius:12,transition:"background .2s", border:`1px solid ${checked?"#fbc02d":THEME.border}`}}>
                  <button onClick={()=>toggleCheck(cb.id)} style={{width:24,height:24,borderRadius:8,border:`2px solid ${checked?"#fbc02d":THEME.subText}`,background:checked?"#fbc02d":"transparent",cursor:"pointer",color:"#fff",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>{checked?"✓":""}</button>
                  <span style={{fontSize:13,color:checked?"#fbc02d":THEME.subText,textDecoration:checked?"line-through":"none",fontWeight:checked?600:400}}>{displayLabel}</span>
                </div>
              );
            })
          )}
        </>
      )}
    </Panel>
  );
}

function IntimacyPanel({data, onUpdate, onClose}) {
  const d = data || {scheduled:false, timeOfDay:"", customTime:"", cycleStart:null, cycleDays:28, mikvahPlanned:false, mikvahDate:null};
  const set = (k,v) => onUpdate({...d,[k]:v});
  const TODAY = todayKey();
  const mikvahEst = d.cycleStart ? addDays(new Date(d.cycleStart).toISOString().slice(0,10), d.cycleDays) : null;
  const isNidda = d.cycleStart && mikvahEst && TODAY < mikvahEst;
  const TIME_OPTIONS = [
    {id:"morning",label:"בוקר",emoji:"🌅",sub:"06:00–12:00"},
    {id:"noon",   label:"צהריים",emoji:"☀️",sub:"12:00–16:00"},
    {id:"evening",label:"ערב",  emoji:"🌆",sub:"16:00–21:00"},
    {id:"night",  label:"לילה", emoji:"🌙",sub:"21:00+"},
    {id:"custom", label:"שעה מדויקת",emoji:"⏰",sub:""},
  ];
  return (
    <Panel title="💕 דייט מיני" color="#c2185b" onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"14px 16px",background:"#fce4ec",borderRadius:14,border:"1px solid #f8bbd0"}}>
        <Tog value={d.scheduled} onChange={v=>set("scheduled",v)} color="#c2185b" size={24}/>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:d.scheduled?"#c2185b":THEME.subText}}>מתוכנן היום 💕</div>
          {d.scheduled&&!isNidda&&<div style={{fontSize:11,color:THEME.subText}}>בחר שעה מתאימה למטה</div>}
        </div>
      </div>
      {isNidda&&<div style={{background:"#ffebee",borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid #ffcdd2",display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>🚫</span><div><div style={{fontSize:13,color:"#ef5350",fontWeight:700}}>נידה פעילה</div><div style={{fontSize:12,color:"#ef5350"}}>עד {fmtDate(mikvahEst)}</div></div></div>}
      {d.scheduled&&!isNidda&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:THEME.subText,fontWeight:700,marginBottom:10}}>⏰ מתי?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {TIME_OPTIONS.map(opt=>(
              <button key={opt.id} onClick={()=>set("timeOfDay",opt.id)} style={{padding:"12px 14px",borderRadius:14,border:`2px solid ${d.timeOfDay===opt.id?"#c2185b":"#f8bbd0"}`,background:d.timeOfDay===opt.id?"#fce4ec":"transparent",cursor:"pointer",textAlign:"right",transition:"all .15s",gridColumn:opt.id==="custom"?"1/-1":"auto"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:20}}>{opt.emoji}</span>
                  <div><div style={{fontSize:13,fontWeight:700,color:d.timeOfDay===opt.id?"#c2185b":THEME.subText}}>{opt.label}</div>{opt.sub&&<div style={{fontSize:10,color:THEME.subText}}>{opt.sub}</div>}</div>
                  {d.timeOfDay===opt.id&&<span style={{marginRight:"auto",color:"#c2185b"}}>✓</span>}
                </div>
                {opt.id==="custom"&&d.timeOfDay==="custom"&&<input type="time" value={d.customTime||""} onClick={e=>e.stopPropagation()} onChange={e=>set("customTime",e.target.value)} style={{marginTop:8,background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"6px 10px",color:THEME.text,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{background:THEME.cardBg,borderRadius:16,padding:16,border:`1px solid ${THEME.border}`, boxShadow: THEME.shadow}}>
        <div style={{fontSize:14,color:"#c2185b",fontWeight:800,marginBottom:14}}>🌸 מחזור ומקווה</div>
        <button onClick={()=>set("cycleStart",Date.now())} style={{width:"100%",background:"#fce4ec",border:"2px dashed #f8bbd0",borderRadius:14,padding:"12px",color:"#c2185b",cursor:"pointer",fontWeight:700,fontSize:14,marginBottom:12}}>🩸 התחיל וסת היום</button>
        {d.cycleStart&&(
          <div style={{background:THEME.inputBg,borderRadius:12,padding:12,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:12,color:THEME.subText,flexShrink:0}}>ימי נידה:</span>
              <input type="number" min={14} max={45} value={d.cycleDays} onChange={e=>set("cycleDays",Number(e.target.value))} style={{width:60,background:THEME.cardBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"5px 8px",color:THEME.text,fontSize:13,textAlign:"center",outline:"none"}}/>
              <button onClick={()=>set("cycleStart",null)} style={{marginRight:"auto",background:THEME.cardBg,border:"none",borderRadius:8,padding:"4px 10px",color:THEME.subText,cursor:"pointer",fontSize:12}}>↺ איפוס</button>
            </div>
            {mikvahEst&&<div style={{padding:"8px 12px",borderRadius:10,background:isNidda?"#ffebee":"#e8f5e9",border:`1px solid ${isNidda?"#ffcdd2":"#c8e6c9"}`,fontSize:13,fontWeight:700,color:isNidda?"#ef5350":"#388e3c"}}>{isNidda?`🚫 נידה עד ${fmtDate(mikvahEst)}`:`✅ מקווה עבר: ${fmtDate(mikvahEst)}`}</div>}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:d.mikvahPlanned?10:0}}>
          <Tog value={d.mikvahPlanned} onChange={v=>set("mikvahPlanned",v)} color="#388e3c"/>
          <span style={{fontSize:13,color:d.mikvahPlanned?"#388e3c":THEME.subText,fontWeight:600}}>💧 ערב מקווה מתוכנן</span>
        </div>
        {d.mikvahPlanned&&<Inp type="date" value={d.mikvahDate||""} onChange={v=>set("mikvahDate",v)}/>}
      </div>
    </Panel>
  );
}

function DateNightPanel({data,onUpdate,onClose}) {
  const d=data||{scheduled:false,day:"",time:"",place:"",budget:""};
  return (
    <Panel title="☕ דייט זוגי" color="#ff4081" onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"12px 14px",background:"#f8bbd0",borderRadius:12}}>
        <Tog value={d.scheduled} onChange={v=>onUpdate({...d,scheduled:v})} color="#ff4081"/>
        <span style={{fontSize:14,fontWeight:600,color:d.scheduled?"#ff4081":THEME.subText}}>מתוכנן השבוע 💕</span>
      </div>
      {d.scheduled&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><div style={{fontSize:11,color:THEME.subText,marginBottom:4}}>📅 יום</div>
            <select value={d.day} onChange={e=>onUpdate({...d,day:e.target.value})} style={{width:"100%",background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"7px 12px",color:THEME.text,fontSize:13,outline:"none"}}>
              <option value="">בחר...</option>{DAYS_HE.map(day=><option key={day} value={day}>{day}</option>)}
            </select></div>
          <div><div style={{fontSize:11,color:THEME.subText,marginBottom:4}}>⏰ שעה</div><Inp type="time" value={d.time} onChange={v=>onUpdate({...d,time:v})}/></div>
          <div><div style={{fontSize:11,color:THEME.subText,marginBottom:4}}>☕ מקום</div><Inp value={d.place} onChange={v=>onUpdate({...d,place:v})} placeholder="שם בית הקפה..."/></div>
          <div><div style={{fontSize:11,color:THEME.subText,marginBottom:4}}>💰 תקציב ₪</div><Inp type="number" value={d.budget} onChange={v=>onUpdate({...d,budget:v})} placeholder="סכום..."/></div>
        </div>
      )}
    </Panel>
  );
}

function DebtPanel({data, onUpdate, names, onClose}) {
  const d = data||{debts:[],payments:[]};
  const [showAddDebt,setShowAddDebt]=useState(false);
  const [newDebt,setNewDebt]=useState({name:"",amount:"",creditor:""});
  const [showAddPay,setShowAddPay]=useState(false);
  const [newPay,setNewPay]=useState({date:todayKey(),amountA:"",amountB:"",note:""});
  const totalDebt = (d.debts||[]).filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0);
  const totalPaid = (d.payments||[]).reduce((s,p)=>s+Number(p.amountA||0)+Number(p.amountB||0),0);
  const paidA = (d.payments||[]).reduce((s,p)=>s+Number(p.amountA||0),0);
  const paidB = (d.payments||[]).reduce((s,p)=>s+Number(p.amountB||0),0);
  const remaining = Math.max(0,totalDebt-totalPaid);
  const progress = totalDebt>0?Math.min(100,(totalPaid/totalDebt)*100):0;
  const addDebt=()=>{if(!newDebt.name||!newDebt.amount)return;onUpdate({...d,debts:[...(d.debts||[]),{id:gid(),...newDebt,amount:Number(newDebt.amount),active:true}]});setNewDebt({name:"",amount:"",creditor:""});setShowAddDebt(false);};
  const removeDebt=(id)=>onUpdate({...d,debts:(d.debts||[]).filter(x=>x.id!==id)});
  const toggleDebt=(id)=>onUpdate({...d,debts:(d.debts||[]).map(x=>x.id===id?{...x,active:!x.active}:x)});
  const editDebt=(id,patch)=>onUpdate({...d,debts:(d.debts||[]).map(x=>x.id===id?{...x,...patch}:x)});
  const addPayment=()=>{if(!newPay.amountA&&!newPay.amountB)return;onUpdate({...d,payments:[...(d.payments||[]),{id:gid(),...newPay}]});setNewPay({date:todayKey(),amountA:"",amountB:"",note:""});setShowAddPay(false);};
  const removePayment=(id)=>onUpdate({...d,payments:(d.payments||[]).filter(x=>x.id!==id)});
  return (
    <Panel title="💰 ניהול חובות" color="#ff9800" onClose={onClose}>
      <div style={{background:"linear-gradient(135deg,#fff3e0,#ffebee)",borderRadius:16,padding:16,marginBottom:16,border:"1px solid #ffe0b2"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <div><div style={{fontSize:10,color:THEME.subText}}>יעד כולל</div><div style={{fontSize:24,fontWeight:900,color:"#ef6c00"}}>{totalDebt.toLocaleString()} ₪</div></div>
          <div style={{textAlign:"left"}}><div style={{fontSize:10,color:THEME.subText}}>נותר</div><div style={{fontSize:24,fontWeight:900,color:remaining===0?"#388e3c":"#d32f2f"}}>{remaining.toLocaleString()} ₪</div></div>
        </div>
        <div style={{height:10,borderRadius:10,background:THEME.border,overflow:"hidden",marginBottom:8}}><div style={{height:"100%",width:`${progress}%`,background:"linear-gradient(90deg,#81c784,#ffb74d)",borderRadius:10,transition:"width .5s"}}/></div>
        <div style={{fontSize:11,color:THEME.subText,textAlign:"center"}}>{progress.toFixed(1)}% שולם</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <div style={{background:"#f3e5f5",borderRadius:10,padding:"8px 12px",border:"1px solid #e1bee7"}}><div style={{fontSize:11,color:"#7b1fa2",fontWeight:700}}>💜 {names.A}</div><div style={{fontSize:16,fontWeight:800,color:"#7b1fa2"}}>{paidA.toLocaleString()} ₪</div></div>
          <div style={{background:"#fce4ec",borderRadius:10,padding:"8px 12px",border:"1px solid #f8bbd0"}}><div style={{fontSize:11,color:"#c2185b",fontWeight:700}}>🩷 {names.B}</div><div style={{fontSize:16,fontWeight:800,color:"#c2185b"}}>{paidB.toLocaleString()} ₪</div></div>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:13,color:"#ef6c00",fontWeight:700}}>📋 רשימת חובות</div>
          <button onClick={()=>setShowAddDebt(s=>!s)} style={{background:"#fff3e0",border:"1px solid #ffe0b2",borderRadius:10,padding:"4px 12px",color:"#ef6c00",cursor:"pointer",fontSize:12}}>+ הוסף</button>
        </div>
        {showAddDebt&&(
          <div style={{background:THEME.cardBg,borderRadius:14,padding:14,marginBottom:10,border:`1px solid ${THEME.border}`, boxShadow: THEME.shadow}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>שם החוב</div><Inp value={newDebt.name} onChange={v=>setNewDebt(p=>({...p,name:v}))} placeholder="כרטיס אשראי..."/></div>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>סכום ₪</div><Inp type="number" value={newDebt.amount} onChange={v=>setNewDebt(p=>({...p,amount:v}))} placeholder="0"/></div>
              <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>נושה</div><Inp value={newDebt.creditor} onChange={v=>setNewDebt(p=>({...p,creditor:v}))} placeholder="שם הנושה (אופציונלי)"/></div>
            </div>
            <div style={{display:"flex",gap:8}}><button onClick={addDebt} style={{flex:1,background:"#ef6c00",border:"none",borderRadius:10,padding:"8px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>✓ הוסף</button><button onClick={()=>setShowAddDebt(false)} style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"8px 14px",color:THEME.subText,cursor:"pointer",fontSize:13}}>ביטול</button></div>
          </div>
        )}
        {(d.debts||[]).map(debt=>(
          <div key={debt.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:6,background:THEME.cardBg,borderRadius:12,border:`1px solid ${debt.active!==false?"#ffe0b2":THEME.border}`}}>
            <Tog value={debt.active!==false} onChange={()=>toggleDebt(debt.id)} color="#ff9800" size={18}/>
            <div style={{flex:1}}>
              <input value={debt.name} onChange={e=>editDebt(debt.id,{name:e.target.value})} style={{background:"transparent",border:"none",color:debt.active!==false?THEME.text:THEME.subText,fontSize:13,fontWeight:700,outline:"none",width:"100%"}}/>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="number" value={debt.amount} onChange={e=>editDebt(debt.id,{amount:Number(e.target.value)})} style={{background:"transparent",border:"none",color:THEME.subText,fontSize:11,outline:"none",width:80}}/>
                <span style={{fontSize:11,color:THEME.subText}}>₪{debt.creditor?` • ${debt.creditor}`:""}</span>
              </div>
            </div>
            <button onClick={()=>removeDebt(debt.id)} style={{background:"#ffebee",border:"none",borderRadius:8,padding:"4px 8px",color:"#ef5350",cursor:"pointer",fontSize:12}}>מחק</button>
          </div>
        ))}
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:13,color:"#388e3c",fontWeight:700}}>✅ תשלומים</div>
          <button onClick={()=>setShowAddPay(s=>!s)} style={{background:"#e8f5e9",border:"1px solid #c8e6c9",borderRadius:10,padding:"4px 12px",color:"#388e3c",cursor:"pointer",fontSize:12}}>+ תשלום</button>
        </div>
        {showAddPay&&(
          <div style={{background:THEME.cardBg,borderRadius:14,padding:14,marginBottom:10,border:"1px solid #c8e6c9", boxShadow: THEME.shadow}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>📅 תאריך</div><Inp type="date" value={newPay.date} onChange={v=>setNewPay(p=>({...p,date:v}))}/></div>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>💜 {names.A} ₪</div><Inp type="number" value={newPay.amountA} onChange={v=>setNewPay(p=>({...p,amountA:v}))} placeholder="0"/></div>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>🩷 {names.B} ₪</div><Inp type="number" value={newPay.amountB} onChange={v=>setNewPay(p=>({...p,amountB:v}))} placeholder="0"/></div>
              <div><div style={{fontSize:10,color:THEME.subText,marginBottom:3}}>📝 הערה</div><Inp value={newPay.note} onChange={v=>setNewPay(p=>({...p,note:v}))} placeholder="אופציונלי"/></div>
            </div>
            <div style={{display:"flex",gap:8}}><button onClick={addPayment} style={{flex:1,background:"#388e3c",border:"none",borderRadius:10,padding:"8px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>✓ רשום</button><button onClick={()=>setShowAddPay(false)} style={{background:THEME.inputBg,border:"none",borderRadius:10,padding:"8px 14px",color:THEME.subText,cursor:"pointer",fontSize:13}}>ביטול</button></div>
          </div>
        )}
        <div style={{maxHeight:220,overflow:"auto"}}>
          {[...(d.payments||[])].reverse().map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",marginBottom:4,background:THEME.cardBg,borderRadius:10, border:`1px solid ${THEME.border}`}}>
              <div style={{flex:1}}><div style={{fontSize:12,color:THEME.text,fontWeight:600}}>{fmtDate(p.date)}{p.note&&` • ${p.note}`}</div><div style={{fontSize:11,color:THEME.subText}}>{p.amountA?<span style={{color:"#7b1fa2"}}>💜{Number(p.amountA).toLocaleString()}₪ </span>:null}{p.amountB?<span style={{color:"#c2185b"}}>🩷{Number(p.amountB).toLocaleString()}₪</span>:null}</div></div>
              <div style={{fontSize:13,fontWeight:700,color:"#388e3c"}}>{(Number(p.amountA||0)+Number(p.amountB||0)).toLocaleString()}₪</div>
              <button onClick={()=>removePayment(p.id)} style={{background:"none",border:"none",color:THEME.subText,cursor:"pointer",fontSize:14,padding:0}}>×</button>
            </div>
          ))}
          {!(d.payments||[]).length&&<div style={{fontSize:13,color:THEME.subText,textAlign:"center",padding:"16px 0"}}>עדיין לא נרשמו תשלומים</div>}
        </div>
      </div>
    </Panel>
  );
}

function ZoomPanel({data, onUpdate, onClose}) {
  const d = data || {attended:false, notes:"", topics:""};
  return (
    <Panel title="💻 שיעור Zoom – יום חמישי" color="#5c6bc0" onClose={onClose}>
      <div style={{background:"#e8eaf6",borderRadius:14,padding:14,marginBottom:14,border:"1px solid #c5cae9"}}>
        <div style={{fontSize:13,color:"#5c6bc0",fontWeight:700,marginBottom:4}}>📅 כל יום חמישי | 19:00–22:00</div>
        <div style={{fontSize:12,color:THEME.subText}}>שיעור קבוע בזום</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"12px 14px",background:d.attended?"#e8f5e9":THEME.cardBg,borderRadius:12, border:`1px solid ${d.attended?"#c8e6c9":THEME.border}`}}>
        <Tog value={d.attended} onChange={v=>onUpdate({...d,attended:v})} color="#388e3c"/>
        <span style={{fontSize:14,fontWeight:600,color:d.attended?"#388e3c":THEME.subText}}>✅ השתתפתי היום</span>
      </div>
      <div style={{marginBottom:10}}><div style={{fontSize:12,color:THEME.subText,marginBottom:4}}>📚 נושאים שנלמדו</div><textarea value={d.topics||""} onChange={e=>onUpdate({...d,topics:e.target.value})} placeholder="מה למדתי היום..." style={{width:"100%",background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"8px 12px",color:THEME.text,fontSize:12,minHeight:70,resize:"vertical",outline:"none",boxSizing:"border-box"}}/></div>
      <div><div style={{fontSize:12,color:THEME.subText,marginBottom:4}}>📝 הערות</div><textarea value={d.notes||""} onChange={e=>onUpdate({...d,notes:e.target.value})} placeholder="הערות חופשיות..." style={{width:"100%",background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"8px 12px",color:THEME.text,fontSize:12,minHeight:56,resize:"vertical",outline:"none",boxSizing:"border-box"}}/></div>
    </Panel>
  );
}

function ViewBar({mode, onMode, selDate, onDate}) {
  const TODAY = todayKey();
  const wk = weekOf(selDate);
  const mo = monthOf(selDate);
  const d = new Date(selDate+"T12:00:00");
  const monthLabel = `${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
  const prevPeriod=()=>{ if(mode==="day") onDate(addDays(selDate,-1)); else if(mode==="week") onDate(addDays(selDate,-7)); else onDate(addDays(selDate,-30)); };
  const nextPeriod=()=>{ if(mode==="day") onDate(addDays(selDate,1)); else if(mode==="week") onDate(addDays(selDate,7)); else onDate(addDays(selDate,30)); };
  return (
    <div style={{padding:"8px 0 4px"}}>
      <div style={{display:"flex",gap:4,marginBottom:10}}>
        {[["day","יום"],["week","שבוע"],["month","חודש"]].map(([m,l])=>(
          <button key={m} onClick={()=>onMode(m)} style={{flex:1,padding:"6px 0",borderRadius:10,border:`1.5px solid ${mode===m?"#5d4037":THEME.border}`,background:mode===m?"#5d4037":"transparent",color:mode===m?"#fff":THEME.subText,cursor:"pointer",fontSize:12,fontWeight:mode===m?700:400,transition:"all .15s"}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
        <button onClick={prevPeriod} style={{background:THEME.inputBg,border:"none",borderRadius:8,padding:"5px 10px",color:THEME.subText,cursor:"pointer",fontSize:14}}>‹</button>
        <div style={{flex:1,textAlign:"center",fontSize:12,color:THEME.subText,fontWeight:600}}>
          {mode==="day"?`${DAYS_HE[dowOf(selDate)]} ${fmtDate(selDate)}`:mode==="week"?`${fmtDate(wk[0])} – ${fmtDate(wk[6])}`:monthLabel}
        </div>
        <button onClick={nextPeriod} style={{background:THEME.inputBg,border:"none",borderRadius:8,padding:"5px 10px",color:THEME.subText,cursor:"pointer",fontSize:14}}>›</button>
        <button onClick={()=>onDate(TODAY)} style={{background:"#5d4037",border:"none",borderRadius:8,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>היום</button>
      </div>
      {(mode==="day"||mode==="week")&&(
        <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:2}}>
          {wk.map((dk,i)=>{
            const isSel=dk===selDate, isT=dk===TODAY;
            return (
              <button key={dk} onClick={()=>onDate(dk)} style={{flexShrink:0,padding:"6px 12px",borderRadius:10,border:`1.5px solid ${isSel?"#5d4037":isT?"#8d6e63":"#d7ccc8"}`,background:isSel?"#5d4037":"transparent",color:isSel?"#fff":isT?"#5d4037":THEME.subText,cursor:"pointer",fontSize:12,fontWeight:isSel||isT?700:400,position:"relative",transition:"all .15s"}}>
                {DAYS_SHORT[i]}
                {isT&&!isSel&&<div style={{width:3,height:3,borderRadius:"50%",background:"#5d4037",position:"absolute",bottom:3,left:"50%",transform:"translateX(-50%)"}}/>}
              </button>
            );
          })}
        </div>
      )}
      {mode==="month"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginTop:4}}>
          {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:THEME.subText,padding:"2px 0"}}>{d}</div>)}
          {Array.from({length:new Date(mo[0]+"T12:00:00").getDay()}).map((_,i)=><div key={"e"+i}/>)}
          {mo.map(dk=>{
            const isSel=dk===selDate, isT=dk===TODAY;
            return (
              <button key={dk} onClick={()=>onDate(dk)} style={{aspectRatio:"1",borderRadius:6,border:`1px solid ${isSel?"#5d4037":isT?"#8d6e63":"transparent"}`,background:isSel?"#5d4037":isT?"#efebe9":"transparent",color:isSel?"#fff":isT?"#5d4037":THEME.subText,cursor:"pointer",fontSize:10,fontWeight:isSel||isT?700:400,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                {new Date(dk+"T12:00:00").getDate()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MAIN APP COMPONENT (FIREBASE SYNCED) ──────────────────────
export default function App() {
  const [history,setHistory]   = useState({});
  const [rec,setRec]           = useState({});
  const [wardrobe,setWardrobe] = useState({moshe:{},hana:{},uri:{}});
  const [wardrobeCats,setWardrobeCats] = useState({moshe:null,hana:null,uri:null});
  const [mealTpl,setMealTpl]   = useState([]);
  const [usageData,setUsageData] = useState({});
  const [names,setNames]       = useState({A:"משה",B:"חנה"});
  const [travelMin,setTravelMin] = useState(15);
  const [season,setSeason]     = useState("חורף");
  const [debtData,setDebtData] = useState({debts:[],payments:[]});
  
  const [loading, setLoading] = useState(true);
  const [selDate,setSelDate]   = useState(todayKey());
  const [viewMode,setViewMode] = useState("week");
  const [openPanel,setOpenPanel] = useState(null);
  const [dismissedAlerts,setDismissedAlerts] = useState([]);
  const TODAY = todayKey();

  // Firebase Sync Logic
  useEffect(() => {
    const rootRef = ref(db, 'family-os-data');
    const unsubscribe = onValue(rootRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.history) setHistory(data.history);
        if (data.rec) setRec(data.rec);
        if (data.wardrobe) setWardrobe(data.wardrobe);
        if (data.wardrobeCats) setWardrobeCats(data.wardrobeCats);
        if (data.mealTpl) setMealTpl(data.mealTpl);
        if (data.usageData) setUsageData(data.usageData);
        if (data.names) setNames(data.names);
        if (data.travelMin) setTravelMin(data.travelMin);
        if (data.season) setSeason(data.season);
        if (data.debtData) setDebtData(data.debtData);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveToFirebase = (path, value) => {
    set(ref(db, `family-os-data/${path}`), value);
  };

  // Wrapper for history updates
  const setHistoryWrapper = (newHistory) => {
    const val = typeof newHistory === 'function' ? newHistory(history) : newHistory;
    setHistory(val);
    saveToFirebase('history', val);
  };
  
  const sd = (dk, d) => {
    const newVal = { ...history, [dk]: d };
    setHistory(newVal);
    saveToFirebase(`history/${dk}`, d);
  };
  const ud = (dk, k, v) => {
    const cur = history[dk] || {};
    const newData = { ...cur, [k]: v };
    const newHistory = { ...history, [dk]: newData };
    setHistory(newHistory);
    saveToFirebase(`history/${dk}/${k}`, v);
  };
  const udFn = (dk, k, updater) => {
    const cur = history[dk] || {};
    const prev = cur[k];
    const next = updater(prev);
    ud(dk, k, next);
  };

  const updateRec = (v) => { 
    const val = typeof v === 'function' ? v(rec) : v; 
    setRec(val); 
    saveToFirebase('rec', val); 
  };
  const updateWardrobe = (v) => { 
    const val = typeof v === 'function' ? v(wardrobe) : v;
    setWardrobe(val); 
    saveToFirebase('wardrobe', val);
  };
  const updateWardrobeCats = (v) => {
    const val = typeof v === 'function' ? v(wardrobeCats) : v;
    setWardrobeCats(val); 
    saveToFirebase('wardrobeCats', val);
  };
  const updateMealTpl = (v) => { setMealTpl(v); saveToFirebase('mealTpl', v); };
  const updateUsageData = (v) => { setUsageData(v); saveToFirebase('usageData', v); };
  const updateNames = (v) => { setNames(v); saveToFirebase('names', v); };
  const updateTravelMin = (v) => { setTravelMin(v); saveToFirebase('travelMin', v); };
  const updateSeason = (v) => { setSeason(v); saveToFirebase('season', v); };
  const updateDebtData = (v) => { 
    const val = typeof v === 'function' ? v(debtData) : v;
    setDebtData(val); 
    saveToFirebase('debtData', val); 
  };

  const gd=dk=>history[dk]||{};

  const handleShift=(shiftId,auto)=>{
    const dk=selDate, dd=gd(dk), prevDay=addDays(dk,-1), prevDd=gd(prevDay);
    const cleaned=(dd.mosheTasks||[]).filter(t=>!t.auto);
    
    const updates = {};
    updates[`history/${dk}`] = {...dd,shift:shiftId,mosheTasks:[...cleaned,...auto.today]};
    
    if(auto.prevDay.length){
        const pc=(prevDd.mosheTasks||[]).filter(t=>!t.auto||!t.text.includes("בגדים"));
        updates[`history/${prevDay}`] = {...prevDd,mosheTasks:[...pc,...auto.prevDay]};
    }

    const newHist = {...history};
    newHist[dk] = updates[`history/${dk}`];
    if(auto.prevDay.length) newHist[prevDay] = updates[`history/${prevDay}`];
    setHistory(newHist);

    Object.keys(updates).forEach(path => {
        const key = path.replace('history/', '');
        set(ref(db, `family-os-data/history/${key}`), updates[path]);
    });

    setOpenPanel(null);
  };

  const handleWorkoutUpdate=(dk,v)=>{
    ud(dk,"workout",v);
    if(v.couple&&v.moshe?.active){
      const prevDay=addDays(dk,-1), prevDd=gd(prevDay), prevTasks=prevDd.mosheTasks||[];
      if(!prevTasks.find(t=>t.text.includes("לאימון"))){
          sd(prevDay,{...prevDd,mosheTasks:[...prevTasks,{id:gid(),text:"👟 להכין בגדים לאימון זוגי למחר",done:false,auto:true}]});
      }
    }
  };

  useEffect(()=>{
    if(loading) return; 
    const dd=gd(selDate);
    const clients=dd.makeup?.clients||[];
    const lastEnd=clients.reduce((max,c)=>c.endTime&&timeToMins(c.endTime)>max?timeToMins(c.endTime):max,0);
    const taskExists=(dd.mosheTasks||[]).find(t=>t.auto&&t.text.includes("לצאת מוקדם"));
    if(lastEnd>timeToMins("15:45")&&!taskExists){
      const newTask={id:gid(),text:"🏃 לצאת מוקדם מהעבודה ולאסוף את אורי (חנה עסוקה עם לקוחה)",done:false,auto:true,time:""};
      ud(selDate,"mosheTasks",[...(dd.mosheTasks||[]),newTask]);
    }
  },[selDate,history,loading]);

  if (loading) return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",color:"#5d4037"}}>טוען נתונים מהענן...</div>;

  const dd=gd(selDate);
  const isThursday=dowOf(selDate)===4;
  const shift=SHIFTS.find(s=>s.id===(dd.shift||"none"))||SHIFTS[0];
  const PCOLORS={A:"#512da8",B:"#c2185b"};
  const buildAlerts=()=>{
    if(selDate!==TODAY) return [];
    const alerts=[];
    if(!dd.shift) alerts.push({text:"משמרת חנה לא הוגדרה להיום",level:"warn"});
    if(dd.makeup?.clients?.some(c=>c.type!=="lashes"&&!c.depositPaid)) alerts.push({text:"יש לקוחה ללא מקדמה – בדוק לפני שהיא מגיעה",level:"err"});
    if(!dd.outfitM?.confirmed&&new Date().getHours()>7) alerts.push({text:"תלבושת לא אושרה – הצע קומבינציה",level:"warn"});
    if(isThursday&&!dd.zoom?.attended) alerts.push({text:"💻 שיעור Zoom הלילה 19:00–22:00 – אל תשכח לסמן",level:"warn"});
    return alerts.filter((_,i)=>!dismissedAlerts.includes(i));
  };
  const alerts=buildAlerts();
  const getNextAction=()=>{
    if(selDate!==TODAY) return null;
    const hr=new Date().getHours();
    if(hr<9&&!dd.outfitM?.confirmed) return "לאשר תלבושת לפני יציאה 👗";
    if(hr<9&&dd.shift&&dd.shift!=="none"&&!(dd.mosheTasks||[]).find(t=>t.text.includes("לגן")&&t.done)) return "להביא את אורי לגן 🚌";
    const unpaid=(dd.makeup?.clients||[]).filter(c=>c.type!=="lashes"&&!c.depositPaid);
    if(unpaid.length) return `לגבות מקדמה מ-${unpaid[0].firstName||"לקוחה"} 💰`;
    const undone=[...(rec.recM||[]),...(dd.mosheTasks||[])].find(t=>!t.done&&!t.auto);
    if(undone) return undone.text;
    if(hr>20&&!(dd.winnerMoshe?.phoneOff)) return "לנתק טלפון לפני שינה 📵";
    return null;
  };
  const nextAction=getNextAction();
  const wkDates=weekOf(selDate);
  const cleaningDay=wkDates.find(dk=>gd(dk).cleaning?.scheduled);
  const hideCleaningToday=cleaningDay&&cleaningDay!==selDate;
  const shoppingDay=wkDates.find(dk=>gd(dk).shopping?.scheduled);
  const hideShoppingToday=shoppingDay&&shoppingDay!==selDate;
  const makeupClients=dd.makeup?.clients||[];
  const makeupTotal=makeupClients.reduce((s,c)=>{if(c.type==="lashes")return s+90;const base=350,extra=Math.max(0,(c.heads||1)-1)*150,travel=c.atHome?0:150;return s+base+extra+travel;},0);
  const totalDebt=(debtData?.debts||[]).filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0);
  const totalPaid=(debtData?.payments||[]).reduce((s,p)=>s+Number(p.amountA||0)+Number(p.amountB||0),0);
  const debtRemaining=Math.max(0,totalDebt-totalPaid);
  const CARDS=[
    {id:"shift", emoji:shift.emoji==="—"?"🏥":shift.emoji, title:"משמרת חנה", color:"#1976d2", subtitle:shift.id==="none"?"לא הוגדרה":shift.label, urgent:shift.id==="morning_ext"},
    {id:"makeup", emoji:"💄", title:"איפור / ריסים", color:"#7b1fa2", subtitle:makeupClients.length===0?"לא מתוכנן":`${makeupClients.length} לקוחות • ${makeupTotal.toLocaleString()}₪`, done:makeupClients.length>0&&makeupClients.every(c=>c.type==="lashes"||c.depositPaid)},
    {id:"outfit", emoji:"👗", title:"לבוש", color:"#c2185b", subtitle:dd.outfitM?.confirmed&&dd.outfitH?.confirmed?"✅ כולם אושרו":"הצע תלבושות", done:dd.outfitM?.confirmed&&dd.outfitH?.confirmed&&dd.outfitU?.confirmed},
    {id:"meals", emoji:"🍽️", title:"ארוחות", color:"#388e3c", subtitle:[dd.meals?.breakfast?.main,dd.meals?.lunch?.main,dd.meals?.dinner?.main].filter(Boolean).join(" • ")||"לא תוכנן", done:!!(dd.meals?.breakfast?.main&&dd.meals?.dinner?.main)},
    {id:"workout", emoji:"🏋️", title:"אימונים", color:"#f57c00", subtitle:dd.workout?.moshe?.active||dd.workout?.hana?.active?"מתוכנן":"לא תוכנן"},
    {id:"tasks", emoji:"✅", title:"משימות", color:"#5d4037", subtitle:(()=>{const all=[...(rec.recM||[]),...(dd.mosheTasks||[]),...(rec.recH||[]),...(dd.hanaTasks||[])];const done=all.filter(t=>t.done).length;return `${done}/${all.length}`;})(), done:(()=>{const all=[...(rec.recM||[]),...(dd.mosheTasks||[]),...(rec.recH||[]),...(dd.hanaTasks||[])];return all.length>0&&all.every(t=>t.done);})()},
    {id:"cleaning", emoji:"🧹", title:"ניקיון", color:"#fbc02d", subtitle:dd.cleaning?.scheduled?"מתוכנן היום":cleaningDay?`ביום ${DAYS_HE[dowOf(cleaningDay)]}`:"לא תוכנן", done:dd.cleaning?.scheduled&&(dd.cleaning?.items||[]).every(i=>i.done), hidden:hideCleaningToday&&!dd.cleaning?.scheduled},
    {id:"shopping", emoji:"🛒", title:"קניות", color:"#0288d1", subtitle:dd.shopping?.scheduled?"מתוכנן היום":shoppingDay?`ביום ${DAYS_HE[dowOf(shoppingDay)]}`:"לא תוכנן", done:dd.shopping?.scheduled&&[...(rec.shopping||[]),...(dd.shopping?.items||[])].every(i=>i.done), hidden:hideShoppingToday&&!dd.shopping?.scheduled},
    {id:"debt", emoji:"💰", title:"ניהול חובות", color:"#ff9800", subtitle:debtRemaining===0?"✅ כל החובות נסגרו!":`נותר ${debtRemaining.toLocaleString()} ₪`, done:debtRemaining===0},
    ...(isThursday?[{id:"zoom", emoji:"💻", title:"שיעור Zoom", color:"#5c6bc0", subtitle:dd.zoom?.attended?"✅ השתתפתי":"19:00–22:00", done:dd.zoom?.attended}]:[]),
    {id:"dateNight", emoji:"☕", title:"דייט זוגי", color:"#ff4081", subtitle:dd.dateNight?.scheduled?[dd.dateNight?.day,dd.dateNight?.time,dd.dateNight?.place].filter(Boolean).join(" • "):"לא תוכנן"},
    {id:"intimacy", emoji:"💕", title:"דייט מיני", color:"#c2185b", subtitle:dd.intimacy?.scheduled?"מתוכנן":"לא תוכנן"},
    {id:"winner_moshe", emoji:"🏆", title:`קוד המנצח – ${names.A}`, color:"#fbc02d", subtitle:"טקס הלילה שלי"},
    {id:"winner_hana",  emoji:"🌙", title:`קוד המנצח – ${names.B}`, color:"#7b1fa2", subtitle:"טקס הלילה שלה"},
  ];
  
  const renderPanel=()=>{
    const close=()=>setOpenPanel(null);
    if(!openPanel) return null;
    if(openPanel==="shift")    return <ShiftPanel data={dd} onShiftChange={handleShift} travelMin={travelMin} onUpdateTravel={updateTravelMin} kidName="אורי" onClose={close}/>;
    if(openPanel==="makeup")   return <MakeupPanel data={dd.makeup} onUpdate={v=>ud(selDate,"makeup",v)} shiftId={dd.shift||"none"} kidName="אורי" onClose={close}/>;
    if(openPanel==="outfit")   return <OutfitPanel wardrobeM={wardrobe.moshe} wardrobeH={wardrobe.hana} wardrobeU={wardrobe.uri} catsM={wardrobeCats.moshe} catsH={wardrobeCats.hana} catsU={wardrobeCats.uri} dataM={dd.outfitM} dataH={dd.outfitH} dataU={dd.outfitU} onM={v=>ud(selDate,"outfitM",v)} onH={v=>ud(selDate,"outfitH",v)} onU={v=>ud(selDate,"outfitU",v)} onWM={v=>updateWardrobe(w=>({...w,moshe:v}))} onWH={v=>updateWardrobe(w=>({...w,hana:v}))} onWU={v=>updateWardrobe(w=>({...w,uri:v}))} onCM={v=>updateWardrobeCats(c=>({...c,moshe:v}))} onCH={v=>updateWardrobeCats(c=>({...c,hana:v}))} onCU={v=>updateWardrobeCats(c=>({...c,uri:v}))} season={season} onClose={close}/>;
    if(openPanel==="meals")    return <MealsPanel data={dd.meals} templates={mealTpl} onUpdate={v=>ud(selDate,"meals",v)} onUpdateTpl={updateMealTpl} onClose={close}/>;
    if(openPanel==="workout")  return <WorkoutPanel data={dd.workout} onUpdate={v=>handleWorkoutUpdate(selDate,v)} wardrobeM={wardrobe.moshe} wardrobeH={wardrobe.hana} onClose={close}/>;
    if(openPanel==="tasks")    return <TasksPanel mT={dd.mosheTasks||[]} hT={dd.hanaTasks||[]} recM={rec.recM||[]} recH={rec.recH||[]} onMT={v=>ud(selDate,"mosheTasks",v)} onHT={v=>ud(selDate,"hanaTasks",v)} onRM={v=>updateRec(r=>({...r,recM:v}))} onRH={v=>updateRec(r=>({...r,recH:v}))} names={names} onClose={close}/>;
    if(openPanel==="cleaning") return <CleaningPanel data={dd.cleaning} allWeekData={history} selectedDate={selDate} onUpdate={v=>ud(selDate,"cleaning",v)} recurring={rec.cleaning} onUpdateRec={v=>updateRec(r=>({...r,cleaning:v}))} onClose={close}/>;
    if(openPanel==="shopping") return <ShoppingPanel data={dd.shopping} onUpdate={v=>ud(selDate,"shopping",v)} recurring={rec.shopping} onUpdateRec={v=>updateRec(r=>({...r,shopping:v}))} usageData={usageData} onUpdateUsage={updateUsageData} onClose={close}/>;
    if(openPanel==="debt")     return <DebtPanel data={debtData} onUpdate={updateDebtData} names={names} onClose={close}/>;
    if(openPanel==="zoom")     return <ZoomPanel data={dd.zoom} onUpdate={v=>ud(selDate,"zoom",v)} onClose={close}/>;
    if(openPanel==="dateNight") return <DateNightPanel data={dd.dateNight} onUpdate={v=>ud(selDate,"dateNight",v)} onClose={close}/>;
    if(openPanel==="intimacy") return <IntimacyPanel data={dd.intimacy} onUpdate={v=>ud(selDate,"intimacy",v)} onClose={close}/>;
    if(openPanel==="winner_moshe") return <WinnerPanel data={dd.winnerMoshe} onUpdate={updater=>udFn(selDate,"winnerMoshe",updater)} who="moshe" name={names.A} onClose={close}/>;
    if(openPanel==="winner_hana")  return <WinnerPanel data={dd.winnerHana}  onUpdate={updater=>udFn(selDate,"winnerHana",updater)}  who="hana"  name={names.B} onClose={close}/>;
  };

  const goals=dd.goals||{A:["",""],B:["",""],doneA:[false,false],doneB:[false,false]};
  return (
    <div style={{minHeight:"100vh",background:THEME.bg,color:THEME.text,fontFamily:"'Segoe UI',system-ui,sans-serif",direction:"rtl",paddingBottom:100}}>
      {renderPanel()}
      <div style={{background:THEME.bg,borderBottom:`1px solid ${THEME.border}`,padding:"12px 16px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:THEME.text}}>🏠 Family Life OS <span style={{fontSize:10,color:THEME.subText,fontWeight:400}}>v6</span></div>
              <div style={{fontSize:11,color:THEME.subText}}>{names.A} & {names.B}</div>
            </div>
            <select value={season} onChange={e=>updateSeason(e.target.value)} style={{background:THEME.inputBg,border:`1px solid ${THEME.border}`,borderRadius:10,padding:"4px 10px",color:THEME.subText,fontSize:12,cursor:"pointer",outline:"none"}}>
              {SEASONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <ViewBar mode={viewMode} onMode={setViewMode} selDate={selDate} onDate={setSelDate}/>
        </div>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"14px 14px"}}>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:18,fontWeight:800}}>
            {DAYS_HE[dowOf(selDate)]} {fmtDate(selDate)}
            {selDate===TODAY&&<span style={{fontSize:11,background:"#5d4037",color:"#fff",borderRadius:8,padding:"2px 8px",marginRight:8,fontWeight:400}}>היום</span>}
          </div>
        </div>
        <SmartAlerts alerts={alerts} onDismiss={i=>setDismissedAlerts(d=>[...d,i])}/>
        {nextAction&&selDate===TODAY&&(
          <div style={{background:"#fff3e0",border:"1px solid #ffe0b2",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10, boxShadow: THEME.shadow}}>
            <div style={{fontSize:20}}>👉</div>
            <div>
              <div style={{fontSize:10,color:"#ef6c00",fontWeight:700,marginBottom:2}}>הפעולה הבאה שלך</div>
              <div style={{fontSize:14,color:THEME.text,fontWeight:600}}>{nextAction}</div>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {["A","B"].map(k=>{
            const gl=k==="A"?goals.A:goals.B; const dl=k==="A"?goals.doneA:goals.doneB; const color=PCOLORS[k];
            return (
              <div key={k} style={{background:THEME.cardBg,borderRadius:14,padding:"12px 14px",border:`1px solid ${color}44`, boxShadow: THEME.shadow}}>
                <div style={{fontSize:11,color,fontWeight:700,marginBottom:8}}>🎯 {names[k]}</div>
                {[0,1].map(i=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                    <button onClick={()=>{const a=[...dl];a[i]=!a[i];ud(selDate,"goals",{...goals,[k==="A"?"doneA":"doneB"]:a});}} style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${dl[i]?color:THEME.subText}`,background:dl[i]?color:"transparent",cursor:"pointer",flexShrink:0,color:"#fff",fontSize:10}}>{dl[i]?"✓":""}</button>
                    <input value={gl[i]} onChange={e=>{const a=[...gl];a[i]=e.target.value;ud(selDate,"goals",{...goals,[k]:a});}} placeholder={`יעד ${i+1}`}
                      style={{flex:1,background:"transparent",border:"none",borderBottom:`1px solid ${dl[i]?color:THEME.border}`,color:dl[i]?THEME.subText:THEME.text,fontSize:11,padding:"2px 0",textDecoration:dl[i]?"line-through":"none",outline:"none"}}/>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {CARDS.map(card=><BigCard key={card.id} {...card} onClick={()=>setOpenPanel(card.id)}/>)}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:THEME.bg,borderTop:`1px solid ${THEME.border}`,padding:"10px 16px",backdropFilter:"blur(10px)"}}>
        <div style={{maxWidth:480,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:12}}>
            {["A","B"].map(k=>{
              const gl=gd(TODAY).goals||{doneA:[false,false],doneB:[false,false]};
              const done=(k==="A"?gl.doneA:gl.doneB)||[false,false];
              const shift2=gd(TODAY).shift;
              return (
                <div key={k}>
                  <div style={{fontSize:10,color:PCOLORS[k],fontWeight:700}}>{names[k]}</div>
                  <div style={{fontSize:10,color:done.filter(Boolean).length===2?"#388e3c":THEME.subText}}>{done.filter(Boolean).length}/2 🎯</div>
                  {k==="B"&&shift2&&shift2!=="none"&&<div style={{fontSize:9,color:shift2==="morning_ext"?"#d32f2f":"#f57c00"}}>{shift2==="morning_ext"?"ססיה":"בוקר"}</div>}
                </div>
              );
            })}
            {debtRemaining>0&&<div style={{borderRight:`1px solid ${THEME.border}`,paddingRight:12,marginRight:4}}/>}
            {debtRemaining>0&&<div><div style={{fontSize:10,color:"#ef6c00",fontWeight:700}}>💰 חובות</div><div style={{fontSize:10,color:THEME.subText}}>{debtRemaining.toLocaleString()}₪</div></div>}
          </div>
          <button onClick={()=>setSelDate(TODAY)} style={{background:"linear-gradient(135deg,#5d4037,#8d6e63)",border:"none",borderRadius:12,padding:"10px 24px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 4px 15px rgba(93, 64, 55, 0.4)"}}>
            היום
          </button>
        </div>
      </div>
    </div>
  );
}