import React, { useState } from "react";
import { Group, Member, AvailabilityBlock, AvailabilityStatus } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Sparkles, Save, Trash2, Calendar, Repeat, MousePointer, Paintbrush, Clock, Check, AlertCircle } from "lucide-react";

interface AvailabilityTabProps {
  group: Group;
  currentUser: string;
  onSyncNeeded: () => void;
}

// 15 hours of the day (8:00 AM to 11:00 PM) - high density, mobile friendly
const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AvailabilityTab({ group, currentUser, onSyncNeeded }: AvailabilityTabProps) {
  const [selectedMode, setSelectedMode] = useState<"recurring" | "specific">("recurring");
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const [activeBrush, setActiveBrush] = useState<AvailabilityStatus>("available");
  const [isPainting, setIsPainting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Get date for specific week offset
  const getWeekDateRangeStr = (offset: number) => {
    const today = new Date();
    const day = today.getDay();
    // Monday is start
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7);
    const startOfWeek = new Date(today.setDate(diff));
    const endOfWeek = new Date(today.setDate(diff + 6));
    
    const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${formatDate(startOfWeek)} – ${formatDate(endOfWeek)}`;
  };

  const getSpecificDateForDay = (dayIndex: number, offset: number) => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7) + dayIndex;
    const date = new Date(today.setDate(diff));
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  // Extract current user's block mappings
  const userBlocks = group.availability.filter((b) => b.member === currentUser) || [];

  // Helper to check status of a cell
  const getCellStatus = (day: string, hour: string): AvailabilityStatus => {
    const timeMatch = (b: AvailabilityBlock) => b.start <= hour && b.end > hour;
    
    if (selectedMode === "recurring") {
      const match = userBlocks.find((b) => b.isRecurring && b.date === day && timeMatch(b));
      return match ? match.status : "unavailable";
    } else {
      const targetDate = getSpecificDateForDay(DAYS_OF_WEEK.indexOf(day), selectedWeekOffset);
      const match = userBlocks.find((b) => !b.isRecurring && b.date === targetDate && timeMatch(b));
      return match ? match.status : "unavailable";
    }
  };

  // Handle painting cells
  const handleCellPaint = (day: string, hour: string) => {
    const currentStatus = getCellStatus(day, hour);
    if (currentStatus === activeBrush) return; // Already painted

    let updatedBlocks = [...group.availability];

    // Determine target date label
    const targetDateLabel = selectedMode === "recurring" 
      ? day 
      : getSpecificDateForDay(DAYS_OF_WEEK.indexOf(day), selectedWeekOffset);

    // Calculate end hour (+1 hour)
    const [hStr, mStr] = hour.split(":");
    const endHour = `${(parseInt(hStr) + 1).toString().padStart(2, "0")}:${mStr}`;

    // Remove overlapping/matching blocks for the same user, same date, same time range
    updatedBlocks = updatedBlocks.filter(
      (b) => !(b.member === currentUser && b.isRecurring === (selectedMode === "recurring") && b.date === targetDateLabel && b.start === hour)
    );

    // Add new painted block (if not clearing/unavailable)
    if (activeBrush !== "unavailable") {
      updatedBlocks.push({
        member: currentUser,
        date: targetDateLabel,
        start: hour,
        end: endHour,
        status: activeBrush,
        isRecurring: selectedMode === "recurring"
      });
    }

    saveBlocksToFirestore(updatedBlocks);
  };

  const handleMouseDown = (day: string, hour: string) => {
    setIsPainting(true);
    handleCellPaint(day, hour);
  };

  const handleMouseEnter = (day: string, hour: string) => {
    if (isPainting) {
      handleCellPaint(day, hour);
    }
  };

  const handleMouseUp = () => {
    setIsPainting(false);
  };

  // Quick patterns templates
  const applyQuickPattern = (pattern: "evenings" | "weekends" | "after6") => {
    const confirmClear = window.confirm("This will overwrite your availability slots for this grid. Continue?");
    if (!confirmClear) return;

    let newBlocks: AvailabilityBlock[] = [];
    if (selectedMode === "recurring") {
      newBlocks = group.availability.filter((b) => !(b.member === currentUser && b.isRecurring));
    } else {
      const startOfWeek = getSpecificDateForDay(0, selectedWeekOffset);
      const endOfWeek = getSpecificDateForDay(6, selectedWeekOffset);
      newBlocks = group.availability.filter((b) => {
        if (b.member === currentUser && !b.isRecurring) {
          return b.date < startOfWeek || b.date > endOfWeek;
        }
        return true;
      });
    }

    const addBlock = (day: string, startH: string, endH: string, status: AvailabilityStatus) => {
      const targetDate = selectedMode === "recurring" 
        ? day 
        : getSpecificDateForDay(DAYS_OF_WEEK.indexOf(day), selectedWeekOffset);

      // We split range into 1-hour blocks matching our cell structure
      const startNum = parseInt(startH.split(":")[0]);
      const endNum = parseInt(endH.split(":")[0]);

      for (let h = startNum; h < endNum; h++) {
        if (h >= 8 && h < 23) {
          const hourStr = `${h.toString().padStart(2, "0")}:00`;
          const nextHourStr = `${(h + 1).toString().padStart(2, "0")}:00`;
          newBlocks.push({
            member: currentUser,
            date: targetDate,
            start: hourStr,
            end: nextHourStr,
            status,
            isRecurring: selectedMode === "recurring"
          });
        }
      }
    };

    if (pattern === "evenings") {
      // Mon-Fri 18:00 - 22:00
      DAYS_OF_WEEK.slice(0, 5).forEach((day) => {
        addBlock(day, "18:00", "22:00", "available");
      });
    } else if (pattern === "weekends") {
      // Sat-Sun 10:00 - 22:00
      DAYS_OF_WEEK.slice(5, 7).forEach((day) => {
        addBlock(day, "10:00", "22:00", "available");
      });
    } else if (pattern === "after6") {
      // Mon-Sun 18:00 - 23:00
      DAYS_OF_WEEK.forEach((day) => {
        addBlock(day, "18:00", "23:00", "available");
      });
    }

    saveBlocksToFirestore(newBlocks);
  };

  const clearGrid = () => {
    if (window.confirm("Are you sure you want to completely clear your schedule for this view?")) {
      let newBlocks: AvailabilityBlock[] = [];
      if (selectedMode === "recurring") {
        newBlocks = group.availability.filter((b) => !(b.member === currentUser && b.isRecurring));
      } else {
        const startOfWeek = getSpecificDateForDay(0, selectedWeekOffset);
        const endOfWeek = getSpecificDateForDay(6, selectedWeekOffset);
        newBlocks = group.availability.filter((b) => {
          if (b.member === currentUser && !b.isRecurring) {
            return b.date < startOfWeek || b.date > endOfWeek;
          }
          return true;
        });
      }
      saveBlocksToFirestore(newBlocks);
    }
  };

  const saveBlocksToFirestore = async (newAvailability: AvailabilityBlock[]) => {
    setSaveStatus("saving");
    try {
      const docRef = doc(db, "groups", group.groupId);
      updateDoc(docRef, {
        availability: newAvailability
      }).catch(err => {
        console.error("Delayed updateDoc error:", err);
      });
      setSaveStatus("saved");
      onSyncNeeded();
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus("idle");
    }
  };

  return (
    <div className="space-y-6" onMouseLeave={handleMouseUp} onMouseUp={handleMouseUp}>
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-dashed border-[#999] pb-4">
        <div>
          <h2 className="text-2xl font-pixel text-teal-950 flex items-center gap-2">
            <Paintbrush className="w-5 h-5 text-teal-800" />
            Paint Your Availability
          </h2>
          <p className="text-xs text-gray-700 font-mono mt-1">
            Drag across the grid to color your blocks. Teal = Free, Yellow = Maybe, Gray = Busy.
          </p>
        </div>
        
        {/* Save Status / Indicators */}
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-xs font-mono bg-blue-100 text-blue-800 border border-blue-400 px-2 py-1 rounded flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
              Saving to group...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs font-mono bg-green-100 text-green-800 border border-green-400 px-2 py-1 rounded flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Synced!
            </span>
          )}
        </div>
      </div>

      {/* Grid view controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Toggle Mode */}
        <div className="md:col-span-4 retro-inset p-3 rounded flex flex-col justify-between">
          <div>
            <span className="block text-xs font-mono font-bold text-gray-700 uppercase mb-2">
              📅 Calendar Mode:
            </span>
            <div className="grid grid-cols-2 gap-1 mb-2">
              <button
                onClick={() => setSelectedMode("recurring")}
                className={`p-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 retro-button ${
                  selectedMode === "recurring" ? "bg-teal-800 text-white border-teal-950" : "text-black"
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                Typical Week
              </button>
              <button
                onClick={() => setSelectedMode("specific")}
                className={`p-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 retro-button ${
                  selectedMode === "specific" ? "bg-teal-800 text-white border-teal-950" : "text-black"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Specific Dates
              </button>
            </div>
          </div>

          {selectedMode === "specific" ? (
            <div className="mt-2 bg-white/60 p-2 rounded border border-gray-300">
              <div className="flex items-center justify-between gap-1">
                <button
                  onClick={() => setSelectedWeekOffset((p) => Math.max(0, p - 1))}
                  disabled={selectedWeekOffset === 0}
                  className="px-1.5 py-0.5 text-xs retro-button font-bold disabled:opacity-30"
                >
                  &lt;
                </button>
                <span className="text-xs font-mono font-bold text-center flex-1">
                  {getWeekDateRangeStr(selectedWeekOffset)}
                </span>
                <button
                  onClick={() => setSelectedWeekOffset((p) => Math.min(5, p + 1))}
                  disabled={selectedWeekOffset === 5}
                  className="px-1.5 py-0.5 text-xs retro-button font-bold disabled:opacity-30"
                >
                  &gt;
                </button>
              </div>
              <span className="block text-[10px] text-gray-600 font-mono text-center mt-1">
                Plan ahead up to 6 weeks!
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-gray-600 font-mono leading-relaxed mt-2 p-1.5 bg-yellow-50 border border-yellow-200 rounded">
              Typical Week sets recurring schedules (e.g. your regular work or class slots). This is used as default.
            </p>
          )}
        </div>

        {/* Paint Brush Selector */}
        <div className="md:col-span-4 retro-inset p-3 rounded">
          <span className="block text-xs font-mono font-bold text-gray-700 uppercase mb-2">
            🎨 Select Brush Status:
          </span>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setActiveBrush("available")}
              className={`w-full p-2 text-xs font-bold rounded flex items-center gap-2 border-2 text-left ${
                activeBrush === "available"
                  ? "border-emerald-600 bg-emerald-100 text-emerald-950 font-bold"
                  : "border-transparent bg-white/80 text-gray-800 hover:bg-white"
              }`}
            >
              <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600"></span>
              Free / Available (Teal-Green)
            </button>
            <button
              onClick={() => setActiveBrush("maybe")}
              className={`w-full p-2 text-xs font-bold rounded flex items-center gap-2 border-2 text-left ${
                activeBrush === "maybe"
                  ? "border-amber-600 bg-amber-100 text-amber-950 font-bold"
                  : "border-transparent bg-white/80 text-gray-800 hover:bg-white"
              }`}
            >
              <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500"></span>
              Maybe / Conditional (Yellow)
            </button>
            <button
              onClick={() => setActiveBrush("unavailable")}
              className={`w-full p-2 text-xs font-bold rounded flex items-center gap-2 border-2 text-left ${
                activeBrush === "unavailable"
                  ? "border-rose-600 bg-rose-50 text-rose-950 font-bold"
                  : "border-transparent bg-white/80 text-gray-800 hover:bg-white"
              }`}
            >
              <span className="w-3.5 h-3.5 rounded bg-gray-300 border border-gray-400"></span>
              Busy / Eraser (Gray)
            </button>
          </div>
        </div>

        {/* Quick Patterns Prefill templates */}
        <div className="md:col-span-4 retro-inset p-3 rounded flex flex-col justify-between">
          <div>
            <span className="block text-xs font-mono font-bold text-gray-700 uppercase mb-2">
              ⚡ Quick Patterns Templates:
            </span>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => applyQuickPattern("evenings")}
                className="w-full text-center p-1.5 text-xs font-bold retro-button bg-gray-100 hover:bg-gray-200 text-black flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-700" />
                Weekday evenings (6–10pm)
              </button>
              <button
                type="button"
                onClick={() => applyQuickPattern("weekends")}
                className="w-full text-center p-1.5 text-xs font-bold retro-button bg-gray-100 hover:bg-gray-200 text-black flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                Weekends (10am–10pm)
              </button>
              <button
                type="button"
                onClick={() => applyQuickPattern("after6")}
                className="w-full text-center p-1.5 text-xs font-bold retro-button bg-gray-100 hover:bg-gray-200 text-black flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Free every day after 6pm
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={clearGrid}
            className="w-full mt-2 text-center p-1.5 text-xs font-bold retro-button bg-red-100 border-red-400 text-red-800 hover:bg-red-200 flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Schedule Grid
          </button>
        </div>
      </div>

      {/* PAINTING GRID */}
      <div className="retro-bevel p-1 shadow-lg overflow-x-auto select-none">
        <div className="min-w-[640px] bg-[#c0c0c0] grid grid-cols-8 divide-x-2 divide-y-2 divide-[#808080]">
          {/* Header row */}
          <div className="p-2 font-mono font-bold text-xs text-gray-800 text-center bg-[#a0a0a0] flex items-center justify-center">
            Time
          </div>
          {DAYS_OF_WEEK.map((day, i) => (
            <div key={day} className="p-2 font-pixel text-center bg-[#a0a0a0] text-sm font-bold flex flex-col items-center justify-center">
              <span>{day.substring(0, 3)}</span>
              {selectedMode === "specific" && (
                <span className="text-[10px] font-mono font-normal mt-0.5 text-gray-700">
                  {getSpecificDateForDay(i, selectedWeekOffset).split("-").slice(1).join("/")}
                </span>
              )}
            </div>
          ))}

          {/* Slots rows */}
          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              {/* Hour Label Column */}
              <div className="p-1 text-[11px] font-mono font-bold text-gray-700 bg-gray-100 text-center flex items-center justify-center h-10 border-r-2 border-[#808080]">
                {hour}
              </div>

              {/* Day cells for this hour */}
              {DAYS_OF_WEEK.map((day) => {
                const status = getCellStatus(day, hour);
                const bgClass =
                  status === "available"
                    ? "bg-teal-400 border-teal-500 hover:bg-teal-300"
                    : status === "maybe"
                    ? "bg-amber-300 border-amber-400 hover:bg-amber-200"
                    : "bg-gray-200 border-gray-300 hover:bg-gray-300";

                return (
                  <div
                    key={`${day}-${hour}`}
                    onMouseDown={() => handleMouseDown(day, hour)}
                    onMouseEnter={() => handleMouseEnter(day, hour)}
                    className={`h-10 transition-all cursor-pointer border-r border-b relative group ${bgClass}`}
                    title={`${day} @ ${hour} - ${status === 'available' ? 'Available' : status === 'maybe' ? 'Maybe' : 'Busy'}`}
                  >
                    {/* Tiny dotted helper pattern for click/paint feedback */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:4px_4px]"></div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
