"use client";

import { useState, useEffect } from "react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Pencil, Users, Clock, DollarSign, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

const ADMIN_TABS = [
  { label: "Items", href: "/inventory" },
  { label: "Contracts", href: "/contracts" },
  { label: "Admin", href: "/admin" },
];

interface WorkLog {
  id: string;
  employeeName: string;
  phone?: string;
  date: string;
  hours: number;
  payout: number;
  note?: string;
}

// yyyy-mm-dd for <input type="date">
const toDateInput = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

const blankForm = () => ({
  id: "",
  employeeName: "",
  phone: "",
  date: toDateInput(new Date()),
  dates: null as string[] | null, // set when logging across several selected days
  hours: "",
  payout: "",
  note: "",
});

// Stable per-employee colors (full literal class names so Tailwind keeps them).
const EMP_COLORS = [
  { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  { chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  { chip: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  { chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500" },
  { chip: "bg-fuchsia-100 text-fuchsia-700", dot: "bg-fuchsia-500" },
];
const colorFor = (name: string) => {
  let h = 0;
  const n = name.trim().toLowerCase();
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return EMP_COLORS[h % EMP_COLORS.length];
};
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export default function AdminPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null); // null = modal closed
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Calendar: first day of the month currently shown
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // Multi-day selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/worklogs");
    const data = await res.json();
    setLogs(data.workLogs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = (dateStr?: string) => { setError(""); setForm({ ...blankForm(), ...(dateStr ? { date: dateStr } : {}) }); };
  const openEdit = (l: WorkLog) => {
    setError("");
    setForm({ id: l.id, employeeName: l.employeeName, phone: l.phone || "", date: toDateInput(l.date), hours: String(l.hours), payout: String(l.payout), note: l.note || "" });
  };

  const save = async () => {
    if (!form.employeeName.trim()) { setError("Employee name is required"); return; }
    setSaving(true); setError("");
    const base = {
      employeeName: form.employeeName,
      phone: form.phone,
      hours: form.hours,
      payout: form.payout,
      note: form.note,
    };

    if (form.id) {
      // Editing a single entry
      const res = await fetch(`/api/worklogs/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, date: form.date }) });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) { setError(data.error || "Couldn't save"); return; }
    } else {
      // Creating — one entry per selected date (or the single date field)
      const dates: string[] = form.dates && form.dates.length ? form.dates : [form.date];
      for (const d of dates) {
        await fetch("/api/worklogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, date: d }) });
      }
      setSaving(false);
    }
    setForm(null);
    setSelectMode(false);
    setSelectedDays(new Set());
    load();
  };

  const remove = async () => {
    if (!form?.id) return;
    if (!confirm("Delete this entry?")) return;
    setSaving(true);
    await fetch(`/api/worklogs/${form.id}`, { method: "DELETE" });
    setSaving(false);
    setForm(null);
    load();
  };

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const totalPayout = logs.reduce((s, l) => s + l.payout, 0);
  const employees = new Set(logs.map((l) => l.employeeName.trim().toLowerCase())).size;

  // Build the month grid and tally entries per day, grouped by employee.
  const todayKey = toDateInput(new Date());
  const perDay: Record<string, Record<string, number>> = {}; // key -> { employeeName -> hours }
  for (const l of logs) {
    const k = toDateInput(l.date);
    if (!perDay[k]) perDay[k] = {};
    perDay[k][l.employeeName] = (perDay[k][l.employeeName] || 0) + l.hours;
  }
  // Distinct employees (for the legend)
  const empNames = Array.from(new Set(logs.map((l) => l.employeeName.trim()))).filter(Boolean).sort();
  const firstWeekday = month.getDay(); // 0 = Sun
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key });
  }
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const orderedKeys = cells.filter(Boolean).map((c) => (c as any).key) as string[];
  const handleDayClick = (key: string, shift: boolean) => {
    if (!selectMode) { openAdd(key); return; }
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (shift && lastClicked) {
        // Select the inclusive range between lastClicked and this day.
        const a = orderedKeys.indexOf(lastClicked);
        const b = orderedKeys.indexOf(key);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(orderedKeys[i]);
        }
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setLastClicked(key);
  };
  const toggleSelectMode = () => {
    setSelectMode((m) => !m);
    setSelectedDays(new Set());
    setLastClicked(null);
  };
  const addToSelected = () => {
    const dates = Array.from(selectedDays).sort();
    if (!dates.length) return;
    setError("");
    setForm({ ...blankForm(), dates, date: dates[0] });
  };

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <SegmentedTabs tabs={ADMIN_TABS} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[40px] sm:text-[48px] leading-none text-ink">Admin</h1>
          <p className="text-[15px] font-medium text-[var(--muted)] mt-1.5">
            Employee work hours &amp; payouts
          </p>
        </div>
        <Button onClick={() => openAdd()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Employees</p>
              <p className="text-2xl font-bold text-gray-900">{employees}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Total Payout</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPayout)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar — click a day (incl. future) to log hours; or select many at once */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-serif text-xl text-ink">{monthLabel}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectMode}
              className={`px-3 h-8 rounded-full text-sm font-medium border transition-colors ${
                selectMode ? "bg-accent text-white border-accent" : "border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {selectMode ? "Done selecting" : "Select days"}
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600" aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="px-3 h-8 rounded-full hover:bg-gray-100 text-sm font-medium text-gray-600">
                Today
              </button>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600" aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Selection action bar */}
        {selectMode && (
          <div className="flex items-center justify-between gap-3 mb-3 rounded-xl bg-accent/10 border border-accent/20 px-4 py-2.5 flex-wrap">
            <p className="text-sm font-medium text-ink">
              {selectedDays.size === 0 ? "Click days to select them (hold Shift to pick a range)." : `${selectedDays.size} day${selectedDays.size === 1 ? "" : "s"} selected`}
            </p>
            <div className="flex items-center gap-2">
              {selectedDays.size > 0 && (
                <button onClick={() => setSelectedDays(new Set())} className="text-sm font-medium text-gray-500 hover:text-gray-700">Clear</button>
              )}
              <Button size="sm" onClick={addToSelected} disabled={selectedDays.size === 0}>
                Log hours for {selectedDays.size || ""} day{selectedDays.size === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 gap-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 uppercase pb-1">{d}</div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`b${i}`} />;
            const info = perDay[cell.key];
            const names = info ? Object.keys(info) : [];
            const isToday = cell.key === todayKey;
            const isSelected = selectedDays.has(cell.key);
            return (
              <button
                key={cell.key}
                onClick={(e) => handleDayClick(cell.key, e.shiftKey)}
                className={`min-h-[72px] rounded-xl border p-1.5 text-left transition-colors flex flex-col gap-1 ${
                  isSelected ? "border-accent bg-accent/15 ring-1 ring-accent"
                  : isToday ? "border-accent bg-accent/5"
                  : "border-gray-200 hover:border-accent/50 hover:bg-gray-50"
                }`}
                title={selectMode ? `Select ${cell.key}` : `Add hours for ${cell.key}`}
              >
                <span className={`text-sm font-medium ${isToday ? "text-accent" : "text-gray-700"}`}>{cell.day}</span>
                <span className="mt-auto flex flex-col gap-0.5">
                  {names.slice(0, 2).map((n) => (
                    <span key={n} className={`rounded-md text-[11px] font-semibold px-1.5 py-0.5 truncate ${colorFor(n).chip}`}>
                      {firstName(n)}
                    </span>
                  ))}
                  {names.length > 2 && (
                    <span className="text-[10px] text-gray-400 font-medium pl-0.5">+{names.length - 2} more</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        {empNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-gray-100">
            {empNames.map((n) => (
              <span key={n} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`h-2.5 w-2.5 rounded-full ${colorFor(n).dot}`} />
                {n}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          {selectMode
            ? "Pick several days, then “Log hours” to apply one entry to all of them."
            : "Tap any day — including future dates — to log work hours, or use “Select days” to cover many at once."}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No entries yet</p>
            <p className="text-sm text-gray-400 mt-1">Click “Add” to log an employee’s hours and payout</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Date</th>
                <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                <th className="text-left p-4 font-medium text-gray-600">Phone</th>
                <th className="text-right p-4 font-medium text-gray-600">Work Hours</th>
                <th className="text-right p-4 font-medium text-gray-600">Payout</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-700">{formatDate(l.date)}</td>
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{l.employeeName}</p>
                    {l.note && <p className="text-xs text-gray-500">{l.note}</p>}
                  </td>
                  <td className="p-4 text-gray-700">
                    {l.phone ? <a href={`tel:${l.phone}`} className="hover:text-indigo-600">{l.phone}</a> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-4 text-right text-gray-900">{l.hours.toFixed(2)}</td>
                  <td className="p-4 text-right font-medium text-gray-900">{formatCurrency(l.payout)}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEdit(l)} className="text-indigo-600 hover:text-indigo-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / edit modal */}
      {form && (
        <Modal open={!!form} onClose={() => setForm(null)} title={form.id ? "Edit Entry" : form.dates && form.dates.length > 1 ? `Add Entry · ${form.dates.length} days` : "Add Entry"} className="max-w-md">
          <div className="space-y-4">
            {form.dates && form.dates.length > 1 ? (
              <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3">
                <p className="text-sm font-medium text-ink">Applying to {form.dates.length} selected days</p>
                <p className="text-xs text-gray-500 mt-0.5">{form.dates.map((d: string) => formatDate(d)).join(" · ")}</p>
                <p className="text-xs text-gray-500 mt-1">One entry (with the hours below) will be created for each day.</p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              {!(form.dates && form.dates.length > 1) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee name</label>
              <Input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work hours</label>
                <Input type="number" min={0} step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payout ($)</label>
                <Input type="number" min={0} step="0.01" value={form.payout} onChange={(e) => setForm({ ...form, payout: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving…" : form.id ? "Save changes" : form.dates && form.dates.length > 1 ? `Add to ${form.dates.length} days` : "Add entry"}</Button>
              {form.id && (
                <Button variant="outline" onClick={remove} disabled={saving} className="gap-1.5 text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
