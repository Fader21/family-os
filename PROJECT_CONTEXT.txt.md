### PROJECT\_CONTEXT.txt



\# PROJECT OVERVIEW: Family OS

\*\*User:\*\* Moshe (Husband) \& Chana (Wife). Son: Ori.

\*\*Role:\*\* Senior React Developer \& Tech Lead.

\*\*Goal:\*\* A mobile-first web app for managing family life, tasks, shifts, shopping, intimacy, and daily rituals ("Winner Code").



\## 🛠 TECH STACK

\* \*\*Framework:\*\* React (Vite)

\* \*\*Language:\*\* JavaScript (ES6+)

\* \*\*Database:\*\* Firebase Realtime Database (Connected \& Active)

\* \*\*Hosting:\*\* Vercel (Deployed via Git)

\* \*\*Styling:\*\* CSS (Custom Dark Mode, Mobile Responsive)

\* \*\*Environment:\*\* Windows PowerShell, VS Code.



\## 📂 CURRENT FILE STRUCTURE \& CONTENT



\### 1. `src/firebase.js` (Configuration)

```javascript

import { initializeApp } from "firebase/app";

import { getDatabase } from "firebase/database";



const firebaseConfig = {

&nbsp; apiKey: "AIzaSyAE7GQrSkHCxPq4ZyMD5aItAzuUa8kkMfc",

&nbsp; authDomain: "family-os-df2eb.firebaseapp.com",

&nbsp; databaseURL: "\[https://family-os-df2eb-default-rtdb.firebaseio.com](https://family-os-df2eb-default-rtdb.firebaseio.com)",

&nbsp; projectId: "family-os-df2eb",

&nbsp; storageBucket: "family-os-df2eb.firebasestorage.app",

&nbsp; messagingSenderId: "990149142658",

&nbsp; appId: "1:990149142658:web:b2065d10532328d334ac9b",

&nbsp; measurementId: "G-F1JFM53WBJ"

};



const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);

2\. src/App.css (Styling - Reset \& Dark Mode)

CSS

body {

&nbsp; margin: 0;

&nbsp; padding: 0;

&nbsp; background-color: #0a0e1a;

&nbsp; font-family: 'Segoe UI', system-ui, sans-serif;

&nbsp; -webkit-font-smoothing: antialiased;

&nbsp; overflow-x: hidden;

}

\* { box-sizing: border-box; }

\#root { width: 100%; min-height: 100vh; }

3\. src/App.jsx (Core Logic - FULL FILE)

Note: This file handles all logic, UI components, and Firebase synchronization.



JavaScript

import { useState, useEffect, useRef } from "react";

import { db } from './firebase';

import { ref, onValue, set } from "firebase/database";

import './App.css';



// ── Constants ────────────────────────────────────────────────

const DAYS\_HE = \["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];

const DAYS\_SHORT = \["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];

const MONTHS\_HE = \["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

const WORKOUT\_TYPES = \["ריצה","אופניים","כוח","טאבטה","זומבה","קל","שחייה"];

const SEASONS = \["חורף","אביב","קיץ","סתיו"];

const gid = () => Math.random().toString(36).slice(2,9);

const pad = n => String(n).padStart(2,"0");

const todayKey = () => { const n=new Date(); return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`; };

const addDays = (dk,n) => { const d=new Date(dk+"T12:00:00"); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

const weekOf = dk => { const d=new Date(dk+"T12:00:00"); d.setDate(d.getDate()-d.getDay()); const base=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; return Array.from({length:7},(\_,i)=>addDays(base,i)); };

const monthOf = dk => { const d=new Date(dk+"T12:00:00"); const y=d.getFullYear(), m=d.getMonth(); const days=\[]; for(let i=1;i<=new Date(y,m+1,0).getDate();i++) days.push(`${y}-${pad(m+1)}-${pad(i)}`); return days; };

const fmtDate = dk => { const d=new Date(dk+"T12:00:00"); return `${d.getDate()} ${MONTHS\_HE\[d.getMonth()]}`; };

const dowOf = dk => new Date(dk+"T12:00:00").getDay();

const fmtTimer = s => `${pad(Math.floor(s/60))}:${pad(s%60)}`;

const addMins = (timeStr, mins) => { if(!timeStr) return ""; const \[h,m]=timeStr.split(":").map(Number); const t=h\*60+m+mins; return `${pad(Math.floor(t/60)%24)}:${pad(t%60)}`; };

const timeToMins = t => { if(!t) return 0; const \[h,m]=t.split(":").map(Number); return h\*60+m; };



// ── DATA LOGIC ────────────────────────────────────────────────

const SHOE\_SOCK\_MAP = {"נעלי ספורט":"גרביים לבנות קצרות","נעלי אלגנט":"גרביים ארוכות","בלנסטון":"גרביים ארוכות"};

const SHIFTS = \[

&nbsp; {id:"none",        label:"אין משמרת",             color:"#374151", emoji:"—"},

&nbsp; {id:"morning",     label:"בוקר 07:00–15:00",       color:"#F59E0B", emoji:"🌅"},

&nbsp; {id:"morning\_ext", label:"בוקר+ססיה 07:00–19:00", color:"#EF4444", emoji:"🔥"},

];



function getMakeupAvailability(shiftId) {

&nbsp; if (!shiftId || shiftId === "none")    return { makeup: true,  lashes: true,  note: null };

&nbsp; if (shiftId === "morning")             return { makeup: true,  lashes: true,  note: "⚠️ בוקר בלבד – איפור רק אחה\\"צ, ריסים בכל שעה" };

&nbsp; if (shiftId === "morning\_ext")         return { makeup: false, lashes: true,  note: "🔥 ססיה – ריסים בלבד (איפור לא זמין)" };

&nbsp; return { makeup: true, lashes: true, note: null };

}



function buildAutoTasks(shiftId, travelMin, kidName) {

&nbsp; if(!shiftId||shiftId==="none") return {today:\[],prevDay:\[]};

&nbsp; const t = \[{id:gid(),text:`🚌 להביא את ${kidName} לגן (07:00)`,done:false,auto:true,time:"07:00"}];

&nbsp; if(shiftId==="morning\_ext"){

&nbsp;   t.push({id:gid(),text:`🚗 לאסוף את ${kidName} מהגן (~18:30)`,done:false,auto:true,time:"18:30"});

&nbsp;   if(travelMin) t.push({id:gid(),text:`⏰ לצאת מהעבודה ${travelMin} דק׳ לפני האיסוף`,done:false,auto:true,time:""});

&nbsp; } else {

&nbsp;   t.push({id:gid(),text:`✅ חנה אוספת את ${kidName} (15:00)`,done:false,auto:true,time:"14:45"});

&nbsp; }

&nbsp; return {today:t, prevDay:\[{id:gid(),text:`👕 להכין בגדים ל${kidName} למחר`,done:false,auto:true}]};

}



// ... \[COMPONENTS OMITTED FOR BREVITY, ASSUME STANDARD REACT COMPONENTS: Chip, Tog, Inp, Confetti, BigCard, Panel, CR, AddRow, SmartAlerts] ...

// ... \[LOGIC PANELS OMITTED FOR BREVITY: ShiftPanel, MakeupPanel, OutfitPanel, MealsPanel, WorkoutPanel, TasksPanel, CleaningPanel, ShoppingPanel, WinnerPanel, IntimacyPanel, DateNightPanel, DebtPanel, ZoomPanel, ViewBar] ...



// ── MAIN APP COMPONENT (FIREBASE SYNCED) ──────────────────────

export default function App() {

&nbsp; const \[history,setHistory]   = useState({});

&nbsp; const \[rec,setRec]           = useState({});

&nbsp; const \[wardrobe,setWardrobe] = useState({moshe:{},hana:{},uri:{}});

&nbsp; const \[wardrobeCats,setWardrobeCats] = useState({moshe:null,hana:null,uri:null});

&nbsp; const \[mealTpl,setMealTpl]   = useState(\[]);

&nbsp; const \[usageData,setUsageData] = useState({});

&nbsp; const \[names,setNames]       = useState({A:"משה",B:"חנה"});

&nbsp; const \[travelMin,setTravelMin] = useState(15);

&nbsp; const \[season,setSeason]     = useState("חורף");

&nbsp; const \[debtData,setDebtData] = useState({debts:\[],payments:\[]});

&nbsp; 

&nbsp; const \[loading, setLoading] = useState(true);

&nbsp; const \[selDate,setSelDate]   = useState(todayKey());

&nbsp; const \[viewMode,setViewMode] = useState("week");

&nbsp; const \[openPanel,setOpenPanel] = useState(null);

&nbsp; const \[dismissedAlerts,setDismissedAlerts] = useState(\[]);

&nbsp; const TODAY = todayKey();



&nbsp; // Firebase Sync Logic

&nbsp; useEffect(() => {

&nbsp;   const rootRef = ref(db, 'family-os-data');

&nbsp;   const unsubscribe = onValue(rootRef, (snapshot) => {

&nbsp;     const data = snapshot.val();

&nbsp;     if (data) {

&nbsp;       if (data.history) setHistory(data.history);

&nbsp;       if (data.rec) setRec(data.rec);

&nbsp;       if (data.wardrobe) setWardrobe(data.wardrobe);

&nbsp;       if (data.wardrobeCats) setWardrobeCats(data.wardrobeCats);

&nbsp;       if (data.mealTpl) setMealTpl(data.mealTpl);

&nbsp;       if (data.usageData) setUsageData(data.usageData);

&nbsp;       if (data.names) setNames(data.names);

&nbsp;       if (data.travelMin) setTravelMin(data.travelMin);

&nbsp;       if (data.season) setSeason(data.season);

&nbsp;       if (data.debtData) setDebtData(data.debtData);

&nbsp;     }

&nbsp;     setLoading(false);

&nbsp;   });

&nbsp;   return () => unsubscribe();

&nbsp; }, \[]);



&nbsp; const saveToFirebase = (path, value) => {

&nbsp;   set(ref(db, `family-os-data/${path}`), value);

&nbsp; };

&nbsp; 

&nbsp; // ... \[REST OF APP LOGIC \& RENDER] ...

}

📝 INSTRUCTIONS FOR THE AI

Context: You are resuming work on "Family OS".



Current State: The app is fully functional and syncing with Firebase. All logic is in App.jsx.



User Constraint: Moshe is the user. He is non-technical but follows terminal instructions perfectly.



Style: Always provide FULL file content when asking Moshe to update code (no // ... existing code placeholders) because he copies and pastes the entire file.



Next Steps: Wait for Moshe's specific request regarding features or bug fixes.

