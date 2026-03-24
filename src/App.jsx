import { useState, useEffect, useCallback, useMemo } from "react";
// import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { supabase } from "./supabase";
// ─── CONSTANTS ────────────────────────────────────────────
const TASKS = [
  { key: "wake", pts: 10, label: "Woke up on time", icon: "⏰", color: "#e94560" },
  { key: "gym", pts: 20, label: "Gym session", icon: "💪", color: "#2ecc71" },
  { key: "study", pts: 15, label: "Study block", icon: "📚", color: "#9b59b6" },
  { key: "sleep", pts: 10, label: "Slept on time", icon: "🛏️", color: "#3498db" },
  { key: "wifeTime", pts: 5, label: "Wife time", icon: "💕", color: "#e91e8c" },
  { key: "water", pts: 5, label: "3L+ water", icon: "💧", color: "#1abc9c" },
];
const MAX_DAILY_XP = 75;
const BONUS_XP = 10;

const RANKS = [
  { min: 0, title: "Couch Potato", emoji: "🥔", color: "#8B7355" },
  { min: 100, title: "Slow Starter", emoji: "🐌", color: "#A0522D" },
  { min: 300, title: "Building Steam", emoji: "🔥", color: "#E8652A" },
  { min: 600, title: "Rhythm Rider", emoji: "🎵", color: "#4A90D9" },
  { min: 1000, title: "Discipline Apprentice", emoji: "⚔️", color: "#7B68EE" },
  { min: 1500, title: "Habit Architect", emoji: "🏗️", color: "#2ECC71" },
  { min: 2500, title: "Morning Warrior", emoji: "🌅", color: "#F39C12" },
  { min: 4000, title: "Routine Sensei", emoji: "🥋", color: "#E74C3C" },
  { min: 6000, title: "Life Boss", emoji: "👑", color: "#FFD700" },
];

const PHASE_INFO = {
  1: { label: "Phase 1 · Weeks 1–2", sleep: "12:30 AM", wake: "7:30 AM", desc: "Settling in — build the habit loops" },
  2: { label: "Phase 2 · Weeks 3–4", sleep: "12:00 AM", wake: "7:00 AM", desc: "Tightening up — sleep shifts earlier" },
  3: { label: "Phase 3 · Week 5+", sleep: "11:30 PM", wake: "6:30 AM", desc: "Morning warrior — own the 6:30 maid alarm" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── HELPERS ──────────────────────────────────────────────
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayStr = () => fmt(new Date());
const getRank = (xp) => {
  let rank = RANKS[0];
  for (const r of RANKS) { if (xp >= r.min) rank = r; }
  const ni = RANKS.indexOf(rank) + 1;
  const next = ni < RANKS.length ? RANKS[ni] : null;
  return { ...rank, next, progress: next ? ((xp - rank.min) / (next.min - rank.min)) * 100 : 100 };
};
const calcXP = (tasks) => {
  let xp = 0;
  TASKS.forEach(t => { if (tasks[t.key]) xp += t.pts; });
  if (TASKS.every(t => tasks[t.key])) xp += BONUS_XP;
  return xp;
};
const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

// ─── SCHEDULES ────────────────────────────────────────────
const typeColors = {
  anchor: { border: "#e94560", text: "#e94560", icon: "⚓" },
  gym: { border: "#2ecc71", text: "#2ecc71", icon: "💪" },
  study: { border: "#9b59b6", text: "#9b59b6", icon: "📚" },
  wife: { border: "#e91e8c", text: "#e91e8c", icon: "💕" },
  work: { border: "#f39c12", text: "#f39c12", icon: "💼" },
  recovery: { border: "#1abc9c", text: "#1abc9c", icon: "🧘" },
  buffer: { border: "#636e72", text: "#95a5a6", icon: "⏸️" },
  flex: { border: "#e67e22", text: "#e67e22", icon: "🔄" },
  move: { border: "#27ae60", text: "#27ae60", icon: "🚶" },
};

const schedules = {
  nonOffice: {
    title: "Non-Office Day", subtitle: "Deep work + gym + study powerhouse", icon: "🏠",
    blocks: [
      { time: "7:30 AM", label: "Wake + Hydrate", desc: "Glass of water, wash face, 5 min stretch. Don't touch your phone for 10 min.", type: "anchor", duration: "15 min" },
      { time: "7:45 – 8:25 AM", label: "STUDY BLOCK 1", desc: "Fresh morning brain = gold. Phone on DND. Course, reading, or certification prep.", type: "study", duration: "40 min" },
      { time: "8:25 AM", label: "Walk to Gym", desc: "50 steps. Playlist ON before you leave the door.", type: "move", duration: "5 min" },
      { time: "8:30 – 9:30 AM", label: "GYM SESSION", desc: "Full workout. Weight training + light cardio. #1 weight loss lever.", type: "gym", duration: "60 min" },
      { time: "9:30 AM", label: "Shower + Snack", desc: "Cold shower finish (30 sec). Protein-rich snack. You've already won the day.", type: "recovery", duration: "25 min" },
      { time: "9:55 – 10:45 AM", label: "STUDY BLOCK 2", desc: "Post-gym wired brain. Combined with Block 1 = ~90 min of growth daily.", type: "study", duration: "50 min" },
      { time: "10:45 AM – 12:45 PM", label: "WIFE TIME", desc: "Breakfast together, help her pack, quality conversation. Phone away.", type: "wife", duration: "2 hrs" },
      { time: "12:45 – 1:30 PM", label: "Lunch + Reset", desc: "Eat well, 15 min power rest or light walk.", type: "recovery", duration: "45 min" },
      { time: "1:30 – 2:30 PM", label: "Freelance 1:1 Session", desc: "Training delivery (until April 1st). Then: deep work / freelance prep.", type: "work", duration: "60 min" },
      { time: "2:30 – 3:00 PM", label: "Break", desc: "Tea, light snack, decompress.", type: "buffer", duration: "30 min" },
      { time: "3:00 – 5:00 PM", label: "DEEP WORK", desc: "Freelance prep, content creation, client work, or extended study.", type: "work", duration: "2 hrs" },
      { time: "5:00 – 6:00 PM", label: "Flex Slot", desc: "Freelance batch (if 5-6 PM) OR errands OR extra study.", type: "flex", duration: "60 min" },
      { time: "6:00 – 7:00 PM", label: "Dinner Prep + Unwind", desc: "Cook or order, YouTube/podcast, decompress.", type: "buffer", duration: "60 min" },
      { time: "7:00 – 8:00 PM", label: "Flex Slot 2", desc: "Freelance batch (if 7-8 PM) OR couple time when wife returns.", type: "flex", duration: "60 min" },
      { time: "8:00 – 10:30 PM", label: "Evening Free", desc: "Couple time, TV, reading, hobbies. No heavy work.", type: "wife", duration: "2.5 hrs" },
      { time: "10:30 PM", label: "Wind Down", desc: "Dim lights, no screens by 11:45 PM, light reading.", type: "anchor", duration: "90 min" },
    ],
  },
  officeDay: {
    title: "Office Day", subtitle: "Gym → Office → Meetings marathon", icon: "🏢",
    blocks: [
      { time: "7:30 AM", label: "Wake + Hydrate", desc: "Same anchor. Water, face wash, stretch.", type: "anchor", duration: "15 min" },
      { time: "7:45 – 8:25 AM", label: "STUDY / GROWTH", desc: "40 min focused study before gym. Consistency is key.", type: "study", duration: "40 min" },
      { time: "8:25 AM", label: "Walk to Gym", desc: "50 steps. Non-negotiable on office days.", type: "move", duration: "5 min" },
      { time: "8:30 – 9:30 AM", label: "GYM SESSION", desc: "Office isn't until 11. No excuse today either.", type: "gym", duration: "60 min" },
      { time: "9:30 AM", label: "Shower + Get Fresh", desc: "Shower, protein snack, get ready for office.", type: "recovery", duration: "30 min" },
      { time: "10:00 – 10:45 AM", label: "Wife Time + Breakfast", desc: "Breakfast together, help her pack, quality chat.", type: "wife", duration: "45 min" },
      { time: "10:45 – 11:15 AM", label: "Get Ready + Commute", desc: "Dress up, pack bag, head to office.", type: "move", duration: "30 min" },
      { time: "11:15 AM – 3:15 PM", label: "OFFICE", desc: "Meetings, collaboration, in-person work. Lunch at office.", type: "work", duration: "4 hrs" },
      { time: "3:15 – 4:30 PM", label: "Commute + Decompress", desc: "Head home, change, snack, 15 min rest.", type: "recovery", duration: "75 min" },
      { time: "4:30 – 5:00 PM", label: "Buffer", desc: "Check messages, prep for evening.", type: "buffer", duration: "30 min" },
      { time: "5:00 – 7:00 PM", label: "Flex Block", desc: "Freelance (if scheduled) OR personal time OR errands.", type: "flex", duration: "2 hrs" },
      { time: "7:00 – 7:30 PM", label: "Dinner + Wife Time", desc: "Quick dinner, catch up with wife.", type: "wife", duration: "30 min" },
      { time: "7:30 – 11:00 PM", label: "OFFICE MEETINGS", desc: "Evening calls. Fixed — build everything else around it.", type: "work", duration: "2-3 hrs" },
      { time: "Post-meetings", label: "Wind Down", desc: "Brief couple check-in, dim lights, bed. Don't doom-scroll.", type: "anchor", duration: "30-60 min" },
    ],
  },
  weekend: {
    title: "Weekend", subtitle: "Recharge, connect, enjoy", icon: "☀️",
    blocks: [
      { time: "8:00 AM", label: "Natural Wake", desc: "30 min later than weekdays. Still alarm — don't sleep past 8:30.", type: "anchor", duration: "—" },
      { time: "8:30 – 9:30 AM", label: "GYM (Optional, +20 XP!)", desc: "Weekend gym = bonus. Even a light 30-40 min counts.", type: "gym", duration: "60 min" },
      { time: "9:30 – 11:00 AM", label: "Slow Morning", desc: "Lazy breakfast, coffee, read, chill. Recovery time.", type: "buffer", duration: "90 min" },
      { time: "11:00 AM onwards", label: "COUPLE TIME / OUTINGS", desc: "Chores, brunch dates, shopping, movies — unstructured but intentional.", type: "wife", duration: "Flexible" },
      { time: "Afternoon", label: "Flex", desc: "Continue outing, chores, or 30-45 min study for bonus XP.", type: "flex", duration: "Flexible" },
      { time: "Evening", label: "Date Night / Relax", desc: "Cook together, watch something, go out. Prioritize connection.", type: "wife", duration: "Flexible" },
      { time: "11:30 PM", label: "Sunday Sleep Prep", desc: "Sunday night sets up Monday. Bed by 12:00 AM max.", type: "anchor", duration: "—" },
    ],
  },
};

// ─── STORAGE LAYER ────────────────────────────────────────
const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .eq("date", key)
      .single();

    if (error) return null;
    return data?.data || null;
  },

  async set(key, val) {
    const { error } = await supabase
      .from("logs")
      .upsert({
        date: key,
        data: val
      });

    return !error;
  },

  async listKeys(prefix) {
    const { data, error } = await supabase
      .from("logs")
      .select("date");

    if (error) return [];
    return data.map(d => prefix + d.date);
  }
};
// ─── MAIN COMPONENT ──────────────────────────────────────
export default function App() {
  const [view, setView] = useState("today");
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [allLogs, setAllLogs] = useState({});
  const [globalData, setGlobalData] = useState({ totalXP: 0, streak: 0, phase: 1, longestStreak: 0 });
  const [scheduleTab, setScheduleTab] = useState("nonOffice");
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  useEffect(() => {
    (async () => {
      const gd = await storage.get("global-data");
      if (gd) setGlobalData(gd);
      const keys = await storage.listKeys("log:");
      const logs = {};
      for (const k of keys) {
        const d = await storage.get(k);
        if (d) logs[k.replace("log:", "")] = d;
      }
      setAllLogs(logs);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = todayStr();
      if (t !== currentDate) setCurrentDate(t);
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  const todayLog = allLogs[currentDate] || { tasks: {}, notes: {}, xp: 0 };

  const saveDayLog = useCallback(async (date, log) => {
    const newLogs = { ...allLogs, [date]: log };
    setAllLogs(newLogs);
    await storage.set(`log:${date}`, log);
  }, [allLogs]);

  const saveGlobal = useCallback(async (data) => {
    setGlobalData(data);
    await storage.set("global-data", data);
  }, []);

  const toggleTask = async (taskKey) => {
    const log = { ...todayLog, tasks: { ...todayLog.tasks, [taskKey]: !todayLog.tasks[taskKey] }, notes: { ...todayLog.notes } };
    log.xp = calcXP(log.tasks);
    await saveDayLog(currentDate, log);
    const updatedLogs = { ...allLogs, [currentDate]: log };
    let total = 0;
    Object.values(updatedLogs).forEach(l => { total += (l.xp || 0); });
    let streakCount = 0;
    const d = new Date();
    while (true) {
      const dk = fmt(d);
      const dl = dk === currentDate ? log : updatedLogs[dk];
      if (dl && dl.xp >= 30) { streakCount++; d.setDate(d.getDate() - 1); }
      else if (dk === currentDate) { d.setDate(d.getDate() - 1); }
      else break;
    }
    await saveGlobal({ ...globalData, totalXP: total, streak: streakCount, longestStreak: Math.max(globalData.longestStreak || 0, streakCount) });
  };

  const saveNote = async (taskKey, note) => {
    const log = { ...todayLog, tasks: { ...todayLog.tasks }, notes: { ...todayLog.notes, [taskKey]: note } };
    log.xp = calcXP(log.tasks);
    await saveDayLog(currentDate, log);
    setEditingTask(null);
  };

  const rank = getRank(globalData.totalXP);
  const todayDone = TASKS.filter(t => todayLog.tasks[t.key]).length;
  const todayXP = todayLog.xp || 0;

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dk = fmt(d);
      const log = allLogs[dk];
      data.push({ date: `${d.getDate()}/${d.getMonth()+1}`, xp: log?.xp || 0 });
    }
    return data;
  }, [allLogs]);

  const radarData = useMemo(() => {
    return TASKS.map(t => {
      let c7 = 0, c30 = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const log = allLogs[fmt(d)];
        if (log?.tasks[t.key]) { c30++; if (i < 7) c7++; }
      }
      return { task: t.icon + " " + t.label, week: Math.round((c7 / 7) * 100), month: Math.round((c30 / 30) * 100) };
    });
  }, [allLogs]);

  const calendarDays = useMemo(() => {
    const dim = getDaysInMonth(calYear, calMonth);
    const fd = getFirstDayOfMonth(calYear, calMonth);
    const days = [];
    for (let i = 0; i < fd; i++) days.push(null);
    for (let i = 1; i <= dim; i++) {
      const dk = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(i).padStart(2,"0")}`;
      const log = allLogs[dk];
      const pct = log ? (TASKS.filter(t => log.tasks[t.key]).length / 6) : 0;
      days.push({ day: i, date: dk, pct, xp: log?.xp || 0, isToday: dk === currentDate });
    }
    return days;
  }, [allLogs, calMonth, calYear, currentDate]);

  const phaseInfo = PHASE_INFO[globalData.phase];
  const now = new Date();
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#08080d", display: "flex", alignItems: "center", justifyContent: "center", color: "#e94560", fontFamily: "monospace", fontSize: "14px" }}>
      Loading your data...
    </div>
  );

  const S = {
    card: { background: "#0e0e16", borderRadius: "10px", border: "1px solid #1a1a25", padding: "14px", marginBottom: "10px" },
    label: { fontSize: "9px", color: "#4a4a5a", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" },
    tab: (a) => ({ flex: 1, padding: "10px 4px", background: a ? "#12121c" : "transparent", border: "none", borderBottom: a ? "2px solid #e94560" : "2px solid transparent", color: a ? "#fff" : "#4a4a5a", fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }),
    btn: (a, c = "#e94560") => ({ padding: "7px 12px", background: a ? c : "#12121c", border: `1px solid ${a ? c : "#1a1a25"}`, borderRadius: "6px", color: a ? "#fff" : "#666", fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }),
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08080d", color: "#d0d0d0", fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace", margin: 0, padding: 0, fontSize: "13px" }}>

      {/* ─── HEADER ─── */}
      <div style={{ background: "linear-gradient(135deg, #0c0c14, #140a1e, #0a141e)", padding: "22px 18px 16px", borderBottom: "1px solid #1a1a25" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "8px", color: "#4a4a5a", letterSpacing: "3px" }}>THE ROUTINE ENGINE</div>
            <div style={{ fontSize: "17px", fontWeight: 800, color: "#fff", marginTop: "3px", fontFamily: "'Georgia', serif" }}>
              {dayName}, {now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div style={{ fontSize: "9px", color: "#444", marginTop: "3px" }}>
              {phaseInfo.label} · 🛏️ {phaseInfo.sleep} → ⏰ {phaseInfo.wake}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "26px" }}>{rank.emoji}</div>
            <div style={{ fontSize: "9px", color: rank.color, fontWeight: 700 }}>{rank.title}</div>
            <div style={{ fontSize: "15px", color: "#fff", fontWeight: 800 }}>{globalData.totalXP} XP</div>
          </div>
        </div>
        <div style={{ marginTop: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7px", color: "#333", marginBottom: "3px" }}>
            <span>{rank.title}</span><span>{rank.next?.title || "MAX"}</span>
          </div>
          <div style={{ height: "4px", background: "#151520", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${rank.progress}%`, background: `linear-gradient(90deg, ${rank.color}, ${rank.next?.color || rank.color})`, borderRadius: "2px", transition: "width 0.5s" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
          {[
            { label: "TODAY", val: `${todayXP}/${MAX_DAILY_XP}`, color: todayXP >= MAX_DAILY_XP ? "#2ecc71" : "#999" },
            { label: "STREAK", val: `${globalData.streak} 🔥`, color: globalData.streak >= 7 ? "#f39c12" : "#999" },
            { label: "BEST", val: `${globalData.longestStreak || 0}d`, color: "#555" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "7px", color: "#333", letterSpacing: "1px" }}>{s.label}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── NAV ─── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a1a25" }}>
        {[
          { key: "today", label: "✅ Today" },
          { key: "schedule", label: "📅 Plan" },
          { key: "analytics", label: "📊 Stats" },
          { key: "calendar", label: "📆 Cal" },
          { key: "rules", label: "📖 Info" },
        ].map(v => <button key={v.key} onClick={() => setView(v.key)} style={S.tab(view === v.key)}>{v.label}</button>)}
      </div>

      <div style={{ padding: "14px 14px 40px" }}>

        {/* ═══ TODAY ═══ */}
        {view === "today" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <svg width="130" height="130" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r="54" fill="none" stroke="#151520" strokeWidth="7" />
                <circle cx="65" cy="65" r="54" fill="none" stroke="url(#cgrad)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(todayDone / 6) * 339.3} 339.3`}
                  transform="rotate(-90 65 65)" style={{ transition: "stroke-dasharray 0.5s ease" }} />
                <defs><linearGradient id="cgrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e94560" /><stop offset="100%" stopColor="#2ecc71" />
                </linearGradient></defs>
                <text x="65" y="58" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800" fontFamily="monospace">{todayDone}/6</text>
                <text x="65" y="76" textAnchor="middle" fill="#555" fontSize="9" fontFamily="monospace">
                  {todayDone === 6 ? "PERFECT DAY!" : "tasks done"}
                </text>
              </svg>
            </div>

            {TASKS.map(t => {
              const checked = !!todayLog.tasks[t.key];
              const note = todayLog.notes?.[t.key];
              const isEditing = editingTask === t.key;
              return (
                <div key={t.key} style={{ ...S.card, borderColor: checked ? t.color + "44" : "#1a1a25", background: checked ? "#0a120a" : "#0e0e16" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div onClick={() => toggleTask(t.key)} style={{
                      width: "26px", height: "26px", borderRadius: "6px", border: `2px solid ${checked ? t.color : "#333"}`,
                      background: checked ? t.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", color: "#fff", cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
                    }}>{checked ? "✓" : ""}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: checked ? t.color : "#ccc" }}>{t.icon} {t.label}</div>
                      {note && !isEditing && <div style={{ fontSize: "9px", color: "#555", marginTop: "1px", fontStyle: "italic" }}>📝 {note}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: checked ? t.color : "#333" }}>+{t.pts}</div>
                      <button onClick={() => setEditingTask(isEditing ? null : t.key)} style={{
                        background: "transparent", border: "1px solid #1a1a25", borderRadius: "4px",
                        color: "#444", fontSize: "9px", padding: "3px 5px", cursor: "pointer", fontFamily: "inherit",
                      }}>✏️</button>
                    </div>
                  </div>
                  {isEditing && (
                    <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #1a1a25" }}>
                      <div style={{ fontSize: "8px", color: "#444", marginBottom: "4px", letterSpacing: "1px" }}>ADD NOTE (e.g., "Gym at 9:30 AM" or "Skipped — knee pain")</div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input defaultValue={note || ""} placeholder="What happened?" id={`note-${t.key}`}
                          onKeyDown={(e) => { if (e.key === "Enter") saveNote(t.key, e.target.value); }}
                          style={{ flex: 1, padding: "7px 10px", background: "#08080d", border: "1px solid #1a1a25", borderRadius: "6px", color: "#ccc", fontSize: "11px", fontFamily: "inherit", outline: "none" }} />
                        <button onClick={() => { const el = document.getElementById(`note-${t.key}`); saveNote(t.key, el?.value || ""); }}
                          style={{ ...S.btn(true, "#2ecc71"), padding: "7px 12px" }}>Save</button>
                      </div>
                      {t.key === "gym" && (
                        <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                          {["8:30 AM ✓", "9:00 AM", "9:30 AM", "10:00 AM", "Skipped"].map(p => (
                            <button key={p} onClick={() => saveNote(t.key, p === "8:30 AM ✓" ? "" : `Gym at ${p}`)}
                              style={{ ...S.btn(false), fontSize: "8px", padding: "3px 7px" }}>{p}</button>
                          ))}
                        </div>
                      )}
                      {t.key === "wake" && (
                        <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                          {["7:30 AM ✓", "8:00 AM", "8:30 AM", "9:00 AM", "After 9:30"].map(p => (
                            <button key={p} onClick={() => saveNote(t.key, p === "7:30 AM ✓" ? "" : `Woke at ${p}`)}
                              style={{ ...S.btn(false), fontSize: "8px", padding: "3px 7px" }}>{p}</button>
                          ))}
                        </div>
                      )}
                      {t.key === "sleep" && (
                        <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                          {["By 12:30 ✓", "1:00 AM", "1:30 AM", "2:00 AM", "After 2 AM"].map(p => (
                            <button key={p} onClick={() => saveNote(t.key, p === "By 12:30 ✓" ? "" : `Slept at ${p}`)}
                              style={{ ...S.btn(false), fontSize: "8px", padding: "3px 7px" }}>{p}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {todayDone === 6 && (
              <div style={{ ...S.card, border: "1px solid #2ecc71", background: "linear-gradient(135deg, #0a1f0a, #0f1a0f)", textAlign: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#2ecc71" }}>🏆 PERFECT DAY BONUS +{BONUS_XP} XP!</span>
              </div>
            )}

            <div style={{ ...S.card, marginTop: "4px" }}>
              <div style={S.label}>Sleep Phase</div>
              <div style={{ display: "flex", gap: "4px" }}>
                {[1,2,3].map(p => (
                  <button key={p} onClick={() => saveGlobal({ ...globalData, phase: p })}
                    style={{ ...S.btn(globalData.phase === p, "#9b59b6"), flex: 1, fontSize: "9px" }}>P{p}: {PHASE_INFO[p].wake}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ SCHEDULE ═══ */}
        {view === "schedule" && (
          <>
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              {Object.entries(schedules).map(([key, s]) => (
                <button key={key} onClick={() => { setScheduleTab(key); setExpandedBlock(null); }}
                  style={{ ...S.btn(scheduleTab === key), flex: 1, padding: "10px 4px", fontSize: "10px" }}>
                  <div style={{ fontSize: "16px", marginBottom: "2px" }}>{s.icon}</div>{s.title}
                </button>
              ))}
            </div>
            <div style={{ fontSize: "10px", color: "#444", marginBottom: "10px", fontStyle: "italic" }}>{schedules[scheduleTab].subtitle}</div>
            <div style={{ position: "relative", paddingLeft: "14px" }}>
              <div style={{ position: "absolute", left: "6px", top: "6px", bottom: "6px", width: "2px", background: "linear-gradient(to bottom, #e94560, #9b59b6, #2ecc71, #f39c12)", opacity: 0.15 }} />
              {schedules[scheduleTab].blocks.map((block, i) => {
                const tc = typeColors[block.type];
                const exp = expandedBlock === i;
                return (
                  <div key={i} onClick={() => setExpandedBlock(exp ? null : i)} style={{
                    position: "relative", marginBottom: "5px", marginLeft: "14px", padding: "9px 11px",
                    background: exp ? "#0e0e1a" : "#0a0a12", border: `1px solid ${exp ? tc.border + "44" : "#111118"}`,
                    borderRadius: "7px", cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{ position: "absolute", left: "-21px", top: "13px", width: "8px", height: "8px", borderRadius: "50%", background: tc.border, border: "2px solid #08080d" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "8px", color: "#3a3a4a", letterSpacing: "0.5px" }}>{block.time}</div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: tc.text, marginTop: "1px" }}>{tc.icon} {block.label}</div>
                      </div>
                      {block.duration && <div style={{ fontSize: "8px", color: "#2a2a3a", background: "#0c0c14", padding: "2px 6px", borderRadius: "6px" }}>{block.duration}</div>}
                    </div>
                    {exp && <div style={{ marginTop: "6px", fontSize: "10px", color: "#777", lineHeight: 1.5, borderTop: `1px solid ${tc.border}22`, paddingTop: "6px" }}>{block.desc}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ ANALYTICS ═══ */}
        {view === "analytics" && (
  <>
    {/* XP BAR CHART */}
    <div style={S.card}>
      <div style={S.label}>XP — Last 30 Days</div>
      <div style={{ display: "flex", gap: "3px", alignItems: "flex-end", height: "140px", marginTop: "10px" }}>
        {chartData.map((p) => {
          const h = Math.max(4, (p.xp / MAX_DAILY_XP) * 130);
          return (
            <div key={p.date} style={{ flex: 1 }}>
              <div
                title={`${p.date}: ${p.xp} XP`}
                style={{
                  height: `${h}px`,
                  borderRadius: "3px 3px 0 0",
                  background: p.xp >= MAX_DAILY_XP
                    ? "linear-gradient(180deg,#2ecc71,#27ae60)"
                    : p.xp > 0
                    ? "linear-gradient(180deg,#e94560,#c0392b)"
                    : "#151520",
                  transition: "all 0.2s"
                }}
              />
            </div>
          );
        })}
      </div>
    </div>

    {/* HABIT CONSISTENCY */}
    <div style={S.card}>
      <div style={S.label}>Habit Consistency</div>
      <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
        {radarData.map((r) => (
          <div key={r.task}>
            <div style={{ fontSize: "10px", color: "#aaa", marginBottom: "4px" }}>{r.task}</div>

            {/* Week */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "8px", color: "#e94560", width: "30px" }}>7d</span>
              <div style={{ flex: 1, height: "6px", background: "#151520", borderRadius: "10px" }}>
                <div style={{ width: `${r.week}%`, height: "100%", background: "#e94560", borderRadius: "10px" }} />
              </div>
              <span style={{ fontSize: "8px", color: "#e94560", width: "28px" }}>{r.week}%</span>
            </div>

            {/* Month */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "8px", color: "#3498db", width: "30px" }}>30d</span>
              <div style={{ flex: 1, height: "6px", background: "#151520", borderRadius: "10px" }}>
                <div style={{ width: `${r.month}%`, height: "100%", background: "#3498db", borderRadius: "10px" }} />
              </div>
              <span style={{ fontSize: "8px", color: "#3498db", width: "28px" }}>{r.month}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* SUMMARY CARDS */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
      {[
        { label: "Total XP", val: globalData.totalXP, color: "#fff" },
        { label: "Streak", val: `${globalData.streak}d`, color: "#f39c12" },
        { label: "Avg Daily", val: (() => {
          const v = Object.values(allLogs).map(l => l.xp || 0);
          return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length) : 0;
        })(), color: "#2ecc71" },
        { label: "Perfect Days", val: Object.values(allLogs).filter(l => l.xp >= MAX_DAILY_XP).length, color: "#9b59b6" },
      ].map((s, i) => (
        <div key={i} style={S.card}>
          <div style={{ fontSize: "8px", color: "#444" }}>{s.label}</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: s.color }}>{s.val}</div>
        </div>
      ))}
    </div>
  </>
)}
        

        {/* ═══ CALENDAR ═══ */}
        {view === "calendar" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
                style={{ background: "transparent", border: "1px solid #1a1a25", borderRadius: "6px", color: "#666", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}>◀</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{MONTHS[calMonth]}</div>
                <div style={{ fontSize: "9px", color: "#444" }}>{calYear}</div>
              </div>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
                style={{ background: "transparent", border: "1px solid #1a1a25", borderRadius: "6px", color: "#666", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}>▶</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "3px" }}>
              {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: "8px", color: "#333", padding: "3px 0", letterSpacing: "1px" }}>{d}</div>)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
              {calendarDays.map((d, i) => {
                if (!d) return <div key={`e${i}`} />;
                const bgO = d.pct > 0 ? 0.15 + d.pct * 0.55 : 0;
                const isFut = new Date(d.date) > new Date();
                return (
                  <div key={d.date} style={{
                    aspectRatio: "1", borderRadius: "5px", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", position: "relative",
                    background: d.isToday ? "#14142a" : isFut ? "#08080d" : `rgba(46, 204, 113, ${bgO})`,
                    border: d.isToday ? "2px solid #e94560" : d.pct >= 1 ? "1px solid #2ecc7133" : "1px solid #0e0e16",
                  }}>
                    <div style={{ fontSize: "11px", fontWeight: d.isToday ? 800 : 500, color: d.isToday ? "#fff" : isFut ? "#2a2a3a" : d.pct > 0 ? "#ccc" : "#333" }}>{d.day}</div>
                    {d.xp > 0 && <div style={{ fontSize: "6px", color: d.xp >= MAX_DAILY_XP ? "#2ecc71" : "#555" }}>{d.xp}xp</div>}
                    {d.pct >= 1 && <div style={{ position: "absolute", top: "1px", right: "2px", fontSize: "6px" }}>⭐</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "10px", flexWrap: "wrap" }}>
              {[
                { label: "Empty", bg: "transparent", border: "#1a1a25" },
                { label: "Some", bg: "rgba(46,204,113,0.25)", border: "transparent" },
                { label: "Most", bg: "rgba(46,204,113,0.55)", border: "transparent" },
                { label: "Perfect ⭐", bg: "rgba(46,204,113,0.75)", border: "#2ecc71" },
              ].map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: l.bg, border: `1px solid ${l.border}` }} />
                  <span style={{ fontSize: "7px", color: "#444" }}>{l.label}</span>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, marginTop: "12px" }}>
              <div style={S.label}>{MONTHS[calMonth]} Summary</div>
              {(() => {
                const ml = Object.entries(allLogs).filter(([k]) => k.startsWith(`${calYear}-${String(calMonth+1).padStart(2,"0")}`));
                const txp = ml.reduce((a, [,l]) => a + (l.xp || 0), 0);
                const perf = ml.filter(([,l]) => l.xp >= MAX_DAILY_XP).length;
                return (
                  <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                    {[
                      { val: txp, label: "TOTAL XP", color: "#fff" },
                      { val: perf, label: "PERFECT", color: "#2ecc71" },
                      { val: ml.length, label: "TRACKED", color: "#9b59b6" },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: "17px", fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: "7px", color: "#3a3a4a" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* ═══ INFO ═══ */}
        {view === "rules" && (
          <>
            <div style={{ ...S.card, borderColor: "#e9456033" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#e94560", marginBottom: "8px" }}>⚡ The 3 Non-Negotiables</div>
              <div style={{ fontSize: "11px", color: "#bbb", lineHeight: 1.8 }}>
                <div style={{ marginBottom: "5px" }}><strong style={{ color: "#2ecc71" }}>1. FIXED WAKE TIME</strong> — Same time daily (±30 min). This fixes everything.</div>
                <div style={{ marginBottom: "5px" }}><strong style={{ color: "#2ecc71" }}>2. GYM AT 8:30 AM</strong> — 50 steps. Study first, gym at 8:30. Done by 9:30.</div>
                <div><strong style={{ color: "#2ecc71" }}>3. SCREENS OFF AT BEDTIME</strong> — Phone charges in another room.</div>
              </div>
            </div>
            <div style={{ ...S.card, borderColor: "#9b59b633" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#9b59b6", marginBottom: "8px" }}>🛏️ Sleep Shift Plan</div>
              {Object.entries(PHASE_INFO).map(([p, info]) => (
                <div key={p} style={{ padding: "7px", background: "#08080d", borderRadius: "6px", marginBottom: "4px", border: parseInt(p) === globalData.phase ? "1px solid #9b59b6" : "1px solid #0e0e16" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: parseInt(p) === globalData.phase ? "#9b59b6" : "#444" }}>{info.label}</div>
                  <div style={{ fontSize: "9px", color: "#666" }}>Sleep: {info.sleep} → Wake: {info.wake}</div>
                </div>
              ))}
            </div>
            <div style={{ ...S.card, borderColor: "#f39c1233" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#f39c12", marginBottom: "8px" }}>📅 April Transition</div>
              <div style={{ fontSize: "11px", color: "#999", lineHeight: 1.7 }}>
                <div>• Office → <strong style={{ color: "#ccc" }}>Wed–Thu–Fri</strong> (3 days/week)</div>
                <div>• 1:1 training ends → 1:30 PM slot becomes deep work</div>
                <div>• New batch April 2nd — lock timing into flex slot</div>
              </div>
            </div>
            <div style={{ ...S.card, borderColor: "#2ecc7133" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#2ecc71", marginBottom: "8px" }}>🏋️ Weight Loss Framework</div>
              <div style={{ fontSize: "11px", color: "#999", lineHeight: 1.7 }}>
                <div>• <strong style={{ color: "#ccc" }}>Gym 5-6x/week</strong> — 50 steps away. No excuse.</div>
                <div>• <strong style={{ color: "#ccc" }}>Walk more</strong> — take calls walking.</div>
                <div>• <strong style={{ color: "#ccc" }}>3L water daily</strong> — tracked as XP.</div>
                <div>• <strong style={{ color: "#ccc" }}>Don't diet, be aware</strong> — swap one junk meal/week.</div>
              </div>
            </div>
            <div style={{ ...S.card, borderColor: "#e91e8c33" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#e91e8c", marginBottom: "8px" }}>💕 Wife Time — Built In</div>
              <div style={{ fontSize: "11px", color: "#999", lineHeight: 1.7 }}>
                <div>• <strong style={{ color: "#ccc" }}>Mornings:</strong> 10:45–12:45 PM sacred couple time</div>
                <div>• <strong style={{ color: "#ccc" }}>Evenings:</strong> Post 7-8 PM together</div>
                <div>• <strong style={{ color: "#ccc" }}>Weekends:</strong> Full days — outings, dates</div>
                <div>• <strong style={{ color: "#ccc" }}>Rule:</strong> Phone away. Presence {">"} hours.</div>
              </div>
            </div>
            <div style={{ ...S.card, borderColor: "#3498db33" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#3498db", marginBottom: "8px" }}>✏️ Tracking Deviations</div>
              <div style={{ fontSize: "11px", color: "#999", lineHeight: 1.7 }}>
                <div>• Tap ✏️ next to any task on the <strong style={{ color: "#ccc" }}>Today</strong> tab</div>
                <div>• Add notes like "Gym at 9:30 AM" or "Skipped — sick"</div>
                <div>• Gym, wake, sleep have <strong style={{ color: "#ccc" }}>quick time presets</strong></div>
                <div>• Still check the task if you did it late — XP counts!</div>
                <div>• All data persists across sessions automatically</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
