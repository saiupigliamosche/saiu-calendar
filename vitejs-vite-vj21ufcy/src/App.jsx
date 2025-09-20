import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/* 🔑 Supabase – Saiu */
const SUPABASE_URL = "https://zqqecvgxmiyrwwjqdnbp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxcWVjdmd4bWl5cnd3anFkbmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA1MjUsImV4cCI6MjA3Mzc4NjUyNX0.9ZfL8RYVRDlmWa8K3kG4YSC63FsOMZexfmMvHrIrpc0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Config */
const VIEW_ONLY = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const BADGE_DISPLAY = ["T", "I", "T", "I"];
const BADGE_KEYS = ["T1", "I1", "T2", "I2"];
const KEY_LOCAL = "saiu.calendar.v13"; // bump cache

/* Colori selezionabili nelle celle grandi */
const COLOR_OPTIONS = [
  { key: "none", label: "Nessuno", value: null },
  { key: "red", label: "Rosso", value: "#FECACA" },
  { key: "green", label: "Verde", value: "#BBF7D0" },
  { key: "yellow", label: "Giallo", value: "#FEF3C7" },
  { key: "purple", label: "Viola", value: "#E9D5FF" },
  { key: "blue", label: "Azzurro", value: "#DBEAFE" },
  { key: "orange", label: "Arancione", value: "#FED7AA" },
];

/* Helpers */
const uid = () => Math.random().toString(36).slice(2, 10);
const monthLabel = (y, m) =>
  new Date(y, m, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeekMon = (d) => { const x = new Date(d); const diff = (x.getDay() + 6) % 7; x.setDate(x.getDate() - diff); return x; };
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/* Store realtime */
function useCalendarStore() {
  const [store, setStore] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY_LOCAL)) || {}; } catch { return {}; } });
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => { localStorage.setItem(KEY_LOCAL, JSON.stringify(store)); }, [store]);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("calendar_days").select("key,payload");
    if (Array.isArray(data)) {
      const map = {}; data.forEach((r) => (map[r.key] = r.payload));
      setStore(map);
    }
  })(); }, []);

  useEffect(() => {
    const ch = supabase.channel("calendar_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_days" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setStore((prev) => { const cp = { ...prev }; delete cp[payload.old.key]; return cp; });
        } else {
          const row = payload.new || payload.record;
          setStore((prev) => ({ ...prev, [row.key]: row.payload }));
        }
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const write = async (y, m, d, payload) => {
    const key = `${y}-${m + 1}-${d}`;
    setStore((prev) => ({ ...prev, [key]: payload }));
    await supabase.from("calendar_days").upsert({ key, payload }).select();
    setLastSaved(new Date());
  };

  const flushAll = async () => {
    const entries = Object.entries(store);
    for (const [key, payload] of entries) {
      await supabase.from("calendar_days").upsert({ key, payload }).select();
    }
    setLastSaved(new Date());
  };

  const read = (y, m, d) => store[`${y}-${m + 1}-${d}`];

  return { read, write, flushAll, lastSaved, store };
}

export default function App() {
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());

  const [centerYear, setCY] = useState(today.getFullYear());
  const [centerMonth, setCM] = useState(today.getMonth());
  const { read, write, flushAll, lastSaved, store } = useCalendarStore();

  /* Griglia mese con settimane dinamiche */
  const genMonthGrid = (y, m) => {
    const first = new Date(y, m, 1);
    const start = startOfWeekMon(first);
    const lastDayOfMonth = new Date(y, m + 1, 0);
    const lastIdxMon0 = (lastDayOfMonth.getDay() + 6) % 7;
    const end = addDays(lastDayOfMonth, 6 - lastIdxMon0);
    const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: totalDays }, (_, i) => addDays(start, i));
  };

  /* 3 mesi consecutivi */
  const triple = useMemo(() => {
    const a = new Date(centerYear, centerMonth, 1);
    const b = new Date(centerYear, centerMonth + 1, 1);
    const c = new Date(centerYear, centerMonth + 2, 1);
    return [
      { y: a.getFullYear(), m: a.getMonth(), label: monthLabel(a.getFullYear(), a.getMonth()), days: genMonthGrid(a.getFullYear(), a.getMonth()) },
      { y: b.getFullYear(), m: b.getMonth(), label: monthLabel(b.getFullYear(), b.getMonth()), days: genMonthGrid(b.getFullYear(), b.getMonth()) },
      { y: c.getFullYear(), m: c.getMonth(), label: monthLabel(c.getFullYear(), c.getMonth()), days: genMonthGrid(c.getFullYear(), c.getMonth()) },
    ];
  }, [centerYear, centerMonth]);

  /* 2 righe grigie prima e dopo */
  const prelude = useMemo(() => {
    const start = addDays(triple[0].days[0], -14);
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, [triple]);
  const postlude = useMemo(() => {
    const last = triple[2].days[triple[2].days.length - 1];
    const start = addDays(last, 1);
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, [triple]);

  const moveTriple = (delta) => {
    const d = new Date(centerYear, centerMonth + delta * 3, 1);
    setCY(d.getFullYear()); setCM(d.getMonth());
    setTimeout(() => {
      const id = `month-${d.getFullYear()}-${d.getMonth()}`;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const jumpToMonth = (y, m) => {
    setCY(y); setCM(m);
    setTimeout(() => {
      const id = `month-${y}-${m}`;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const overviewYear = useMemo(() => new Date(centerYear, centerMonth, 1).getFullYear(), [centerYear, centerMonth]);

  return (
    <div className="app-shell">
      {/* MAIN */}
      <div className="cal-root">
        <div className="cal-header">
          <div className="cal-nav">
            <button className="btn" onClick={() => moveTriple(-1)}>←</button>
            <div className="title">
              {monthLabel(triple[0].y, triple[0].m)} – {monthLabel(triple[2].y, triple[2].m)}
            </div>
            <button className="btn" onClick={() => moveTriple(1)}>→</button>
          </div>
          <div className="actions">
            {!VIEW_ONLY && <button className="btn primary" onClick={flushAll} title="Forza salvataggio">Salva</button>}
            <span className="save-status">{lastSaved ? `Salvato ✓ ${lastSaved.toLocaleTimeString()}` : "Pronto"}</span>
          </div>
        </div>

        <div className="grid7 head">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
            <div key={d} className="head-cell">{d}</div>
          ))}
        </div>

        {/* PRE */}
        <Section dim label="…">
          <Grid14>
            {prelude.map((d) => (
              <Day
                key={`pre-${dateKey(d)}`}
                d={d}
                inMonth={false}
                today={sameDay(d, today)}
                read={read}
                write={write}
                todayDateOnly={today}
              />
            ))}
          </Grid14>
        </Section>

        {/* TRE MESI */}
        {triple.map((blk) => (
          <Section key={`m-${blk.y}-${blk.m}`} label={blk.label} id={`month-${blk.y}-${blk.m}`}>
            <div className="grid7 body" style={{ gridAutoRows: "120px" }}>
              {blk.days.map((d) => {
                const dk = dateKey(d);
                if (d.getMonth() !== blk.m) {
                  return <div key={`ph-${dk}`} className="cell placeholder" aria-hidden="true" />;
                }
                return (
                  <Day
                    key={dk}
                    d={d}
                    inMonth={true}
                    today={sameDay(d, today)}
                    read={read}
                    write={write}
                    todayDateOnly={today}
                  />
                );
              })}
            </div>
          </Section>
        ))}

        {/* POST */}
        <Section dim label="…">
          <Grid14>
            {postlude.map((d) => (
              <Day
                key={`post-${dateKey(d)}`}
                d={d}
                inMonth={false}
                today={sameDay(d, today)}
                read={read}
                write={write}
                todayDateOnly={today}
              />
            ))}
          </Grid14>
        </Section>
      </div>

      {/* ASIDE OVERVIEW */}
      <aside className="aside">
        <div className="aside-head">
          <div className="aside-title">Overview {overviewYear}</div>
        </div>
        <YearMini year={overviewYear} store={store} onJump={jumpToMonth} todayDateOnly={today} />
      </aside>
    </div>
  );
}

/* Layout */
function Section({ label, children, dim = false, id }) {
  return (
    <div className={`month-section ${dim ? "dim" : ""}`} id={id}>
      <div className="month-label">{label}</div>
      {children}
    </div>
  );
}
const Grid14 = ({ children }) => <div className="grid7 body short14">{children}</div>;

/* Menu tendina */
function Menu({ options, onSelect, onClose }) {
  useEffect(() => {
    const h = (e) => { if (!e.target.closest(".menu")) onClose?.(); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [onClose]);

  return (
    <div className="menu">
      {options.map((opt) => (
        <button
          key={opt.key}
          className="menu-item"
          onClick={() => { if (opt.value === "__sep") return; onSelect(opt); onClose?.(); }}
        >
          <span className="color-dot" style={{ background: opt.value || "transparent", border: opt.value ? "none" : "1px solid #d1d5db" }} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* Giorno (cella grande) */
function Day({ d, inMonth, today, read, write, todayDateOnly }) {
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const initial =
    read(d.getFullYear(), d.getMonth(), d.getDate()) || {
      items: [],
      badges: { T1: false, I1: false, T2: false, I2: false },
      crossed: null, // null = automatico
      bg: null,
    };
  const [dd, setDD] = useState(initial);
  const [cellMenuOpen, setCellMenuOpen] = useState(false);
  const [itemMenuFor, setItemMenuFor] = useState(null);

  useEffect(() => {
    const fresh = read(d.getFullYear(), d.getMonth(), d.getDate());
    if (fresh) setDD(fresh);
  }, [read, d]);

  const commit = (patch) => {
    if (VIEW_ONLY) return;
    const next = { ...dd, ...patch };
    setDD(next);
    write(d.getFullYear(), d.getMonth(), d.getDate(), next);
  };

  const isPast = d < todayDateOnly;
  const showCross = dd.crossed === null ? isPast : dd.crossed;

  const onDouble = (e) => {
    if (VIEW_ONLY) return;
    if (e.altKey) {
      commit({ crossed: null }); // torna automatico
    } else {
      const next = dd.crossed === true ? false : true;
      commit({ crossed: next });
    }
  };

  const setCellBg = (value) => commit({ bg: value });
  const toggleBadge = (k) => commit({ badges: { ...dd.badges, [k]: !dd.badges[k] } });

  const addItem = () => {
    if (VIEW_ONLY) return;
    const t = prompt("Testo");
    if (!t) return;
    commit({ items: [...dd.items, { id: uid(), text: t.trim(), bg: null }] });
  };
  const rmItem = (id) => commit({ items: dd.items.filter((x) => x.id !== id) });
  const setItemBg = (id, value) => {
    const items = dd.items.map((it) => (it.id === id ? { ...it, bg: value } : it));
    commit({ items });
  };

  // Drag & drop
  const onDragStart = (e, id) => { if (VIEW_ONLY) return; e.dataTransfer.setData("text/plain", JSON.stringify({ id, from: key })); };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e) => {
    if (VIEW_ONLY) return;
    e.preventDefault();
    const { id, from } = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (!id) return;
    if (from === key) {
      const idx = dd.items.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const items = [...dd.items];
      const [it] = items.splice(idx, 1);
      items.push(it);
      commit({ items });
    } else {
      const [fy, fm, fd] = from.split("-").map((n) => parseInt(n, 10));
      const src =
        read(fy, fm - 1, fd) || {
          items: [],
          badges: { T1: false, I1: false, T2: false, I2: false },
          crossed: null,
          bg: null,
        };
      const it = src.items.find((x) => x.id === id);
      if (!it) return;
      write(fy, fm - 1, fd, { ...src, items: src.items.filter((x) => x.id !== id) });
      commit({ items: [...dd.items, it] });
    }
  };

  return (
    <div
      className={`cell ${inMonth ? "" : "faded"} ${today ? "today" : ""} ${VIEW_ONLY ? "readonly" : ""}`}
      style={{ background: dd.bg || "white" }}
      onDoubleClick={onDouble}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="day-number">{d.getDate()}</div>

      {/* Badge */}
      <div className="badges">
        {BADGE_KEYS.map((k, i) => (
          <button
            key={k}
            className={`badge ${dd.badges?.[k] ? "on" : ""}`}
            onClick={(e) => { e.stopPropagation(); if (!VIEW_ONLY) toggleBadge(k); }}
          >
            {BADGE_DISPLAY[i]}
          </button>
        ))}
      </div>

      {/* Palette cella */}
      {!VIEW_ONLY && (
        <button className="cell-palette" onClick={(e) => { e.stopPropagation(); setCellMenuOpen((v) => !v); }} title="Colore cella">🎨</button>
      )}
      {cellMenuOpen && !VIEW_ONLY && (
        <Menu options={COLOR_OPTIONS} onSelect={(opt) => setCellBg(opt.value)} onClose={() => setCellMenuOpen(false)} />
      )}

      {/* Items */}
      <div className="items">
        {dd.items.map((it) => (
          <span
            key={it.id}
            className="pill"
            draggable={!VIEW_ONLY}
            onDragStart={(e) => onDragStart(e, it.id)}
            onClick={(e) => { e.stopPropagation(); if (VIEW_ONLY) return; setItemMenuFor(it.id); }}
            style={{ background: it.bg || "transparent", borderColor: "#111", color: "#111" }}
            title={VIEW_ONLY ? "Sola lettura" : "Click per colore / elimina"}
          >
            {it.text}
            {/* Menu pill */}
            {itemMenuFor === it.id && !VIEW_ONLY && (
              <Menu
                options={[...COLOR_OPTIONS, { key: "__sep", label: "—", value: "__sep" }, { key: "__del", label: "Elimina", value: "__del" }]}
                onSelect={(opt) => { if (opt.value === "__sep") return; if (opt.value === "__del") rmItem(it.id); else setItemBg(it.id, opt.value); }}
                onClose={() => setItemMenuFor(null)}
              />
            )}
          </span>
        ))}
      </div>

      {/* + */}
      {!VIEW_ONLY && <button className="add" onClick={(e) => { e.stopPropagation(); addItemPrompt(commit, dd); }}>+</button>}

      {/* X */}
      {showCross && (
        <svg className="cross" viewBox="0 0 100 100">
          <line x1="0" y1="0" x2="100" y2="100" stroke="#111" strokeWidth="3" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="#111" strokeWidth="3" />
        </svg>
      )}
    </div>
  );
}

function addItemPrompt(commit, dd) {
  const t = prompt("Testo");
  if (!t) return;
  commit({ items: [...dd.items, { id: uid(), text: t.trim(), bg: null }] });
}

/* OVERVIEW ANNO (mini) – semplice, con X e highlight se modificato */
function YearMini({ year, store, onJump, todayDateOnly }) {
  const months = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="year-mini">
      {months.map((m) => (
        <MiniMonth
          key={`mini-${year}-${m}`}
          year={year}
          month={m}
          store={store}
          onJump={onJump}
          todayDateOnly={todayDateOnly}
        />
      ))}
    </div>
  );
}

function MiniMonth({ year, month, store, onJump, todayDateOnly }) {
  const first = new Date(year, month, 1);
  const start = startOfWeekMon(first);
  const last = new Date(year, month + 1, 0);
  const lastIdxMon0 = (last.getDay() + 6) % 7;
  const end = addDays(last, 6 - lastIdxMon0);
  const total = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const days = Array.from({ length: total }, (_, i) => addDays(start, i));

  const label = first.toLocaleString(undefined, { month: "short" });

  return (
    <div className="mini-month">
      <div className="mini-label">{label}</div>
      <div className="mini-grid">
        {days.map((d) => {
          const inMonth = d.getMonth() === month;
          const k = dateKey(d);
          const p =
            store[k] || {
              items: [],
              badges: { T1: false, I1: false, T2: false, I2: false },
              crossed: null,
              bg: null,
            };

          // modificato? (note, badge, bg, X forzata true/false)
          const modified =
            (Array.isArray(p.items) && p.items.length > 0) ||
            (p.badges && Object.values(p.badges).some(Boolean)) ||
            p.bg ||
            p.crossed !== null;

          // X: automatica se crossed === null
          const isPast = d < todayDateOnly;
          const showCross = p.crossed === null ? isPast : p.crossed;

          return (
            <div
              key={`mini-${k}`}
              className={`mini-cell ${inMonth ? "" : "mini-faded"} ${modified ? "mini-has" : ""}`}
              title={`${d.getDate()}/${month + 1}/${year}`}
              onClick={() => onJump(year, month)}
              style={{ cursor: "pointer" }}
            >
              <div className="mini-num">{d.getDate()}</div>
              {showCross && (
                <svg className="mini-cross" viewBox="0 0 100 100">
                  <line x1="0" y1="0" x2="100" y2="100" stroke="#111" strokeWidth="6" />
                  <line x1="100" y1="0" x2="0" y2="100" stroke="#111" strokeWidth="6" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}