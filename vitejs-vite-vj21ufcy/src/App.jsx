import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// 🔑 Supabase – connessione Saiu
const SUPABASE_URL = "https://zqqecvgxmiyrwwjqdnbp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxcWVjdmd4bWl5cnd3anFkbmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA1MjUsImV4cCI6MjA3Mzc4NjUyNX0.9ZfL8RYVRDlmWa8K3kG4YSC63FsOMZexfmMvHrIrpc0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Config
const VIEW_ONLY = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const BADGE_DISPLAY = ["T","I","T","I"];
const BADGE_KEYS    = ["T1","I1","T2","I2"];
const SOFTS = [null,"#FFF7CC","#DFF7EA","#DCEEFF","#F0E6FF"];
const KEY_LOCAL = "saiu.calendar.v8"; // bump cache

// Helpers
const uid = () => Math.random().toString(36).slice(2, 10);
const monthLabel = (y,m) => new Date(y,m,1).toLocaleString(undefined,{month:"long",year:"numeric"});
const addDays = (d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const startOfWeekMon = (d)=>{const x=new Date(d);const diff=(x.getDay()+6)%7;x.setDate(x.getDate()-diff);return x;};
const sameDay = (a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

// Supabase realtime store
function useCalendarStore() {
  const [store,setStore] = useState(() => {
    try {return JSON.parse(localStorage.getItem(KEY_LOCAL))||{};} catch {return {};}
  });
  useEffect(()=>{localStorage.setItem(KEY_LOCAL,JSON.stringify(store));},[store]);

  // fetch iniziale
  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.from("calendar_days").select("key,payload");
      if (Array.isArray(data)) {
        const map={}; data.forEach(r=>map[r.key]=r.payload);
        setStore(map);
      }
    })();
  },[]);

  // realtime
  useEffect(()=>{
    const ch = supabase.channel("calendar_updates")
      .on("postgres_changes",{event:"*",schema:"public",table:"calendar_days"},payload=>{
        if(payload.eventType==="DELETE"){
          setStore(prev=>{const cp={...prev};delete cp[payload.old.key];return cp;});
        } else {
          const row=payload.new||payload.record;
          setStore(prev=>({...prev,[row.key]:row.payload}));
        }
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  },[]);

  const write = async (y,m,d,payload)=>{
    const key=`${y}-${m+1}-${d}`;
    setStore(prev=>({...prev,[key]:payload}));
    await supabase.from("calendar_days").upsert({key,payload}).select();
  };
  const read = (y,m,d)=>store[`${y}-${m+1}-${d}`];
  return {read,write};
}

export default function App() {
  const today = new Date();
  const [centerYear,setCY] = useState(today.getFullYear());
  const [centerMonth,setCM] = useState(today.getMonth());
  const {read,write} = useCalendarStore();

  /**
   * Genera la griglia del mese con NUMERO DI SETTIMANE DINAMICO.
   * - start = lunedì della prima settimana che include il 1° del mese
   * - end   = domenica dell’ultima settimana che include l’ultimo giorno del mese
   * => weeks = 4, 5 o 6 → niente riga vuota “in più”
   */
  const genMonthGrid = (y,m)=>{
    const first = new Date(y,m,1);
    const start = startOfWeekMon(first);
    const lastDayOfMonth = new Date(y, m+1, 0);
    const lastIdxMon0 = (lastDayOfMonth.getDay()+6)%7; // 0..6, lun=0
    const end = addDays(lastDayOfMonth, 6 - lastIdxMon0); // domenica di quella settimana
    const totalDays = Math.round((end - start) / (1000*60*60*24)) + 1; // multiplo di 7
    const out=[]; for(let i=0;i<totalDays;i++) out.push(addDays(start,i));
    return out;
  };

  // 3 mesi consecutivi: corrente + 1 + 2
  const triple = useMemo(()=>{
    const a=new Date(centerYear,centerMonth,1);
    const b=new Date(centerYear,centerMonth+1,1);
    const c=new Date(centerYear,centerMonth+2,1);
    return [
      {y:a.getFullYear(),m:a.getMonth(),label:monthLabel(a.getFullYear(),a.getMonth()),days:genMonthGrid(a.getFullYear(),a.getMonth())},
      {y:b.getFullYear(),m:b.getMonth(),label:monthLabel(b.getFullYear(),b.getMonth()),days:genMonthGrid(b.getFullYear(),b.getMonth())},
      {y:c.getFullYear(),m:c.getMonth(),label:monthLabel(c.getFullYear(),c.getMonth()),days:genMonthGrid(c.getFullYear(),c.getMonth())},
    ];
  },[centerYear,centerMonth]);

  // 2 righe grigie SOLO prima e dopo il blocco
  const prelude = useMemo(()=>{
    const start=addDays(triple[0].days[0],-14);
    return Array.from({length:14},(_,i)=>addDays(start,i));
  },[triple]);
  const postlude = useMemo(()=>{
    const start=addDays(triple[2].days[triple[2].days.length-1],1);
    return Array.from({length:14},(_,i)=>addDays(start,i));
  },[triple]);

  const moveTriple = delta => {
    const d = new Date(centerYear, centerMonth + delta*3, 1);
    setCY(d.getFullYear()); setCM(d.getMonth());
  };

  return (
    <div className="cal-root">
      <div className="cal-header">
        <div className="cal-nav">
          <button className="btn" onClick={()=>moveTriple(-1)}>←</button>
          <div className="title">{monthLabel(triple[0].y,triple[0].m)} – {monthLabel(triple[2].y,triple[2].m)}</div>
          <button className="btn" onClick={()=>moveTriple(1)}>→</button>
        </div>
      </div>

      <div className="grid7 head">
        {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(d=><div key={d} className="head-cell">{d}</div>)}
      </div>

      {/* PRELUDIO */}
      <Section dim label="…">
        <Grid14>
          {prelude.map((d,i)=>
            <Day key={"pre"+i} d={d} inMonth={false} today={sameDay(d,today)} read={read} write={write}/>
          )}
        </Grid14>
      </Section>

      {/* TRE MESI – senza giorni fuori mese (niente anteprime in mezzo) */}
      {triple.map((blk,i)=>
        <Section key={i} label={blk.label}>
          <div className="grid7 body" style={{ gridAutoRows: "120px" }}>
            {blk.days.map((d,j)=>{
              if (d.getMonth() !== blk.m) {
                // Cellette fuori mese non visibili (no spazio aggiuntivo)
                return <div key={j} className="cell placeholder" aria-hidden="true" />;
              }
              return (
                <Day key={j} d={d} inMonth={true} today={sameDay(d,today)} read={read} write={write}/>
              );
            })}
          </div>
        </Section>
      )}

      {/* POSTLUDIO */}
      <Section dim label="…">
        <Grid14>
          {postlude.map((d,i)=>
            <Day key={"post"+i} d={d} inMonth={false} today={sameDay(d,today)} read={read} write={write}/>
          )}
        </Grid14>
      </Section>
    </div>
  );
}

function Section({label,children,dim=false}) {
  return <div className={`month-section ${dim?"dim":""}`}><div className="month-label">{label}</div>{children}</div>;
}
const Grid14=({children})=><div className="grid7 body short14">{children}</div>;

function Day({d,inMonth,today,read,write}) {
  const key=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const initial=read(d.getFullYear(),d.getMonth(),d.getDate())||{items:[],badges:{T1:false,I1:false,T2:false,I2:false},crossed:false,bg:null};
  const [dd,setDD]=useState(initial);

  useEffect(()=>{
    const fresh=read(d.getFullYear(),d.getMonth(),d.getDate());
    if(fresh) setDD(fresh);
  },[read,d]);

  const commit=patch=>{
    if(VIEW_ONLY) return;
    const next={...dd,...patch};
    setDD(next);
    write(d.getFullYear(),d.getMonth(),d.getDate(),next);
  };

  const toggleCross=()=>commit({crossed:!dd.crossed});
  const cycleCellBg=()=>{const i=SOFTS.indexOf(dd.bg??null);commit({bg:SOFTS[(i+1)%SOFTS.length]});};
  const toggleBadge=k=>commit({badges:{...dd.badges,[k]:!dd.badges[k]}});
  const addItem=()=>{if(VIEW_ONLY) return;const t=prompt("Testo");if(!t)return;commit({items:[...dd.items,{id:uid(),text:t,bg:null}]});};
  const rmItem=id=>commit({items:dd.items.filter(x=>x.id!==id)});
  const cycleItemBg=id=>{
    const items=dd.items.map(it=>it.id===id?{...it,bg:SOFTS[(SOFTS.indexOf(it.bg??null)+1)%SOFTS.length]}:it);
    commit({items});
  };

  const onDragStart=(e,id)=>{if(VIEW_ONLY)return;e.dataTransfer.setData("text/plain",JSON.stringify({id,from:key}));};
  const onDragOver=e=>e.preventDefault();
  const onDrop=e=>{
    if(VIEW_ONLY) return;
    e.preventDefault();
    const {id,from}=JSON.parse(e.dataTransfer.getData("text/plain"));
    if(!id) return;
    if(from===key){
      const idx=dd.items.findIndex(i=>i.id===id); if(idx<0) return;
      const items=[...dd.items]; const [it]=items.splice(idx,1); items.push(it);
      commit({items});
    } else {
      const [fy,fm,fd]=from.split("-").map(n=>parseInt(n,10));
      const src=read(fy,fm-1,fd)||{items:[],badges:{T1:false,I1:false,T2:false,I2:false},crossed:false,bg:null};
      const it=src.items.find(x=>x.id===id); if(!it) return;
      write(fy,fm-1,fd,{...src,items:src.items.filter(x=>x.id!==id)});
      commit({items:[...dd.items,it]});
    }
  };

  return (
    <div className={`cell ${inMonth?"":"faded"} ${today?"today":""} ${VIEW_ONLY?"readonly":""}`}
      style={{background:dd.bg||"white"}}
      onDoubleClick={()=>{if(!VIEW_ONLY)toggleCross();}}
      onClick={e=>{if(!VIEW_ONLY&&e.shiftKey)cycleCellBg();}}
      onDragOver={onDragOver}
      onDrop={onDrop}>
      <div className="day-number">{d.getDate()}</div>
      <div className="badges">
        {BADGE_KEYS.map((k,i)=>
          <button key={k} className={`badge ${dd.badges?.[k]?"on":""}`}
            onClick={e=>{e.stopPropagation();if(!VIEW_ONLY)toggleBadge(k);}}>
            {BADGE_DISPLAY[i]}
          </button>
        )}
      </div>
      <div className="items">
        {dd.items.map(it=>
          <span key={it.id} className="pill" draggable={!VIEW_ONLY}
            onDragStart={e=>onDragStart(e,it.id)}
            onClick={e=>{e.stopPropagation();if(VIEW_ONLY)return;if(e.shiftKey)cycleItemBg(it.id);else rmItem(it.id);}}
            style={{background:it.bg||"transparent",borderColor:"#111",color:"#111"}}>
            {it.text}
          </span>
        )}
      </div>
      {!VIEW_ONLY && <button className="add" onClick={e=>{e.stopPropagation();addItem();}}>+</button>}
      {dd.crossed && <svg className="cross" viewBox="0 0 100 100"><line x1="0" y1="0" x2="100" y2="100" stroke="#111" strokeWidth="3"/><line x1="100" y1="0" x2="0" y2="100" stroke="#111" strokeWidth="3"/></svg>}
    </div>
  );
}