import React, { useState, useEffect } from "react";
import { Group, Member, AvailabilityBlock, AvailabilityStatus, Idea } from "../types";
import { Users, Clock, Calendar, CheckSquare, Square, Award, AlertCircle, PlusCircle } from "lucide-react";
import "../css/SuggestionsTab.css";

interface SuggestionsTabProps {
  group: Group;
  currentUser: string;
  onProposeTime: (prefilledIdea: Partial<Idea>) => void;
}

interface OverlapSuggestion {
  dayOrDate: string; // "Monday" or "YYYY-MM-DD"
  start: string;     // "HH:MM"
  end: string;       // "HH:MM"
  durationHours: number;
  freeMembers: string[];
  isWeekendOrEvening: boolean;
  score: number;
}

const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SuggestionsTab({ group, currentUser, onProposeTime }: SuggestionsTabProps) {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<"recurring" | "specific">("recurring");
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const [minDuration, setMinDuration] = useState<number>(2); // Default 2 hours
  const [preferWeekendsEvenings, setPreferWeekendsEvenings] = useState<boolean>(true);
  const [suggestions, setSuggestions] = useState<OverlapSuggestion[]>([]);
  const [searched, setSearched] = useState(false);

  // Initialize with current user selected by default
  useEffect(() => {
    if (group.members.length > 0) {
      setSelectedMembers([currentUser]);
    }
  }, [group.members, currentUser]);

  const toggleMember = (name: string) => {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  const selectAllMembers = () => {
    setSelectedMembers(group.members.map((m) => m.name));
  };

  const clearSelectedMembers = () => {
    setSelectedMembers([]);
  };

  const getSpecificDateForDay = (dayIndex: number, offset: number) => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7) + dayIndex;
    const date = new Date(today.setDate(diff));
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const getWeekDateRangeStr = (offset: number) => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7);
    const startOfWeek = new Date(today.setDate(diff));
    const endOfWeek = new Date(today.setDate(diff + 6));
    
    const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${formatDate(startOfWeek)} – ${formatDate(endOfWeek)}`;
  };

  const calculateSuggestions = () => {
    if (selectedMembers.length < 2) {
      alert("Please select at least 2 members to find overlaps.");
      return;
    }

    setSuggestions([]);
    setSearched(true);

    const blocks: OverlapSuggestion[] = [];

    // Target days/dates list
    const targetDaysOrDates = selectedMode === "recurring"
      ? DAYS_OF_WEEK
      : DAYS_OF_WEEK.map((_, i) => getSpecificDateForDay(i, selectedWeekOffset));

    targetDaysOrDates.forEach((dayOrDate, dayIdx) => {
      let currentBlock: Partial<OverlapSuggestion> | null = null;

      // Keep track of member availability statuses for this slot
      HOURS.forEach((hour, hourIdx) => {
        const freeMembersInHour: string[] = [];
        
        selectedMembers.forEach((memberName) => {
          // Find if user has a block for this slot
          const userBlocks = group.availability.filter((b) => b.member === memberName);
          const hourMatch = (b: AvailabilityBlock) => b.start <= hour && b.end > hour;

          let status: AvailabilityStatus = "unavailable";
          if (selectedMode === "recurring") {
            const match = userBlocks.find((b) => b.isRecurring && b.date === dayOrDate && hourMatch(b));
            if (match) status = match.status;
          } else {
            const match = userBlocks.find((b) => !b.isRecurring && b.date === dayOrDate && hourMatch(b));
            if (match) status = match.status;
          }

          // Count member as free if they are 'available' or 'maybe'
          if (status === "available" || status === "maybe") {
            freeMembersInHour.push(memberName);
          }
        });

        // Determine if this hour satisfies partial matching
        // In full matching, everyone selected is free.
        // In partial matching, at least 2 people (or N-1 if large group) must be free.
        const requiredFreeCount = selectedMembers.length; // strict overlap first
        const isOverlapHour = freeMembersInHour.length >= requiredFreeCount;

        if (isOverlapHour) {
          // It's a valid overlap slot! Extend current block or start a new one
          if (!currentBlock) {
            currentBlock = {
              dayOrDate,
              start: hour,
              freeMembers: freeMembersInHour,
              durationHours: 1,
            };
          } else {
            currentBlock.durationHours = (currentBlock.durationHours || 0) + 1;
          }
        } else {
          // Break in contiguous block. Finalize the previous block if valid
          if (currentBlock && currentBlock.durationHours && currentBlock.durationHours >= minDuration) {
            // Compute end hour
            const startH = parseInt(currentBlock.start!.split(":")[0]);
            const endHourStr = `${(startH + currentBlock.durationHours).toString().padStart(2, "0")}:00`;
            
            // Check weekend or evening rules
            const isWeekend = selectedMode === "recurring"
              ? ["Saturday", "Sunday"].includes(dayOrDate)
              : ["Saturday", "Sunday"].includes(DAYS_OF_WEEK[dayIdx]);
            
            const startHNum = parseInt(currentBlock.start!.split(":")[0]);
            const isEvening = startHNum >= 17; // After 5 PM

            blocks.push({
              dayOrDate: currentBlock.dayOrDate!,
              start: currentBlock.start!,
              end: endHourStr,
              durationHours: currentBlock.durationHours,
              freeMembers: currentBlock.freeMembers!,
              isWeekendOrEvening: isWeekend || isEvening,
              score: 0 // Will score below
            });
          }
          currentBlock = null;
        }
      });

      // Handle block running to the end of hours list
      if (currentBlock && currentBlock.durationHours && currentBlock.durationHours >= minDuration) {
        const startH = parseInt(currentBlock.start!.split(":")[0]);
        const endHourStr = `${(startH + currentBlock.durationHours).toString().padStart(2, "0")}:00`;
        const isWeekend = selectedMode === "recurring"
          ? ["Saturday", "Sunday"].includes(dayOrDate)
          : ["Saturday", "Sunday"].includes(DAYS_OF_WEEK[dayIdx]);
        
        const startHNum = parseInt(currentBlock.start!.split(":")[0]);
        const isEvening = startHNum >= 17;

        blocks.push({
          dayOrDate: currentBlock.dayOrDate!,
          start: currentBlock.start!,
          end: endHourStr,
          durationHours: currentBlock.durationHours,
          freeMembers: currentBlock.freeMembers!,
          isWeekendOrEvening: isWeekend || isEvening,
          score: 0
        });
      }
    });

    // Score and Rank suggestions:
    // Rank by: 
    // 1. Coverage (free members / total selected) -> 1000 pts per member
    // 2. Contiguous length -> 100 pts per hour
    // 3. Weekends/evenings setting enabled -> +200 pts
    // 4. If specific mode, earlier days get higher score (+10 pts per day sooner)
    const scoredSuggestions = blocks.map((b) => {
      let score = b.freeMembers.length * 1000;
      score += b.durationHours * 100;
      if (preferWeekendsEvenings && b.isWeekendOrEvening) {
        score += 200;
      }
      return { ...b, score };
    });

    // Sort by score desc, then by date/day index
    scoredSuggestions.sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      return x.dayOrDate.localeCompare(y.dayOrDate);
    });

    // Limit to top 5 suggestions
    setSuggestions(scoredSuggestions.slice(0, 5));
  };

  const handlePropose = (s: OverlapSuggestion) => {
    // Generate prefilled proposal object
    let propDatetime = "";
    if (selectedMode === "specific") {
      propDatetime = `${s.dayOrDate}T${s.start}`;
    }

    const newProposal: Partial<Idea> = {
      title: "Hangout Proposal",
      datetime: propDatetime,
      notes: `Suggested overlapping slot: ${s.dayOrDate} ${s.start} - ${s.end} (${s.durationHours} hrs). Free: ${s.freeMembers.join(", ")}`,
      suggestedBy: currentUser,
    };

    onProposeTime(newProposal);
  };

  return (
    <div className="suggestions-tab">
      <div className="app-section-header">
        <h2 className="app-section-title">
          <Award className="w-5 h-5 text-teal-800" />
          Smart Overlap Finder
        </h2>
        <p className="app-section-subtitle">
          Select friends, adjust parameters, and calculate the best free slots instantly.
        </p>
      </div>

      <div className="suggestions-tab__layout grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Member Selector Box */}
        <div className="suggestions-tab__panel suggestions-tab__panel--members retro-bevel p-3 rounded">
          <div className="suggestions-tab__panel-head flex items-center justify-between border-b border-[#999] pb-2 mb-2">
            <span className="suggestions-tab__panel-title text-xs font-mono font-bold text-gray-800 uppercase flex items-center gap-1.5">
              <Users className="w-4 h-4 text-teal-800" />
              1. Select People:
            </span>
            <div className="suggestions-tab__panel-actions flex gap-1.5">
              <button
                type="button"
                onClick={selectAllMembers}
                className="suggestions-tab__tiny-btn text-[10px] font-mono px-1 border border-gray-400 bg-white hover:bg-gray-50 rounded"
              >
                All
              </button>
              <button
                type="button"
                onClick={clearSelectedMembers}
                className="suggestions-tab__tiny-btn text-[10px] font-mono px-1 border border-gray-400 bg-white hover:bg-gray-50 rounded"
              >
                None
              </button>
            </div>
          </div>

          <div className="suggestions-tab__member-list space-y-1.5 max-h-[220px] overflow-y-auto p-1 bg-white/60 rounded border border-gray-300">
            {group.members.map((member) => {
              const isSelected = selectedMembers.includes(member.name);
              return (
                <button
                  key={member.name}
                  type="button"
                  onClick={() => toggleMember(member.name)}
                  className={`suggestions-tab__member-item ${
                    isSelected
                      ? "suggestions-tab__member-item--active"
                      : "suggestions-tab__member-item"
                  }`}
                >
                  <div className="suggestions-tab__member-main">
                    <span
                      className="suggestions-tab__member-color"
                      style={{ backgroundColor: member.color }}
                    ></span>
                    <span>{member.name} {member.name === currentUser ? "(You)" : ""}</span>
                  </div>
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-teal-800" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              );
            })}
          </div>
          <span className="suggestions-tab__member-count block text-[10px] text-gray-600 font-mono mt-1 text-center">
            {selectedMembers.length} of {group.members.length} friends selected
          </span>
        </div>

        {/* Adjust Suggestions Parameters */}
        <div className="suggestions-tab__panel suggestions-tab__panel--rules retro-bevel p-3 rounded flex flex-col justify-between">
          <div className="suggestions-tab__rules-body space-y-4">
            <span className="suggestions-tab__panel-title block text-xs font-mono font-bold text-gray-800 uppercase border-b border-[#999] pb-2 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-800" />
              2. Overlap Rules:
            </span>

            {/* Calendar Mode */}
            <div>
              <label className="suggestions-tab__label block text-[11px] font-mono font-bold text-gray-700 uppercase mb-1">
                Calendar Schedule:
              </label>
              <div className="suggestions-tab__mode-grid grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedMode("recurring")}
                  className={`suggestions-tab__mode-btn p-1.5 text-xs font-bold rounded retro-button ${
                    selectedMode === "recurring" ? "bg-teal-800 text-white border-teal-950" : "text-black"
                  }`}
                >
                  Typical Week
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode("specific")}
                  className={`suggestions-tab__mode-btn p-1.5 text-xs font-bold rounded retro-button ${
                    selectedMode === "specific" ? "bg-teal-800 text-white border-teal-950" : "text-black"
                  }`}
                >
                  Specific Dates
                </button>
              </div>

              {selectedMode === "specific" && (
                <div className="suggestions-tab__week-picker mt-1.5 flex items-center justify-between gap-1 bg-white/80 p-1.5 rounded border border-gray-300">
                  <button
                    onClick={() => setSelectedWeekOffset((p) => Math.max(0, p - 1))}
                    disabled={selectedWeekOffset === 0}
                    className="suggestions-tab__week-nav px-1.5 text-xs font-bold retro-button disabled:opacity-20"
                  >
                    &lt;
                  </button>
                  <span className="suggestions-tab__week-label text-[10px] font-mono font-bold text-center flex-1">
                    {getWeekDateRangeStr(selectedWeekOffset)}
                  </span>
                  <button
                    onClick={() => setSelectedWeekOffset((p) => Math.min(5, p + 1))}
                    disabled={selectedWeekOffset === 5}
                    className="suggestions-tab__week-nav px-1.5 text-xs font-bold retro-button disabled:opacity-20"
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>

            {/* Min Duration */}
            <div>
              <label className="suggestions-tab__label block text-[11px] font-mono font-bold text-gray-700 uppercase mb-1">
                Minimum Duration:
              </label>
              <select
                value={minDuration}
                onChange={(e) => setMinDuration(Number(e.target.value))}
                className="retro-combobox"
              >
                <option value={1}>1 Hour</option>
                <option value={2}>2 Hours</option>
                <option value={3}>3 Hours</option>
                <option value={4}>4 Hours</option>
              </select>
            </div>

            {/* Prefer weekends/evenings */}
            <label className="suggestions-tab__checkbox-row flex items-center gap-2 cursor-pointer bg-white/40 p-2 rounded border border-gray-200">
              <input
                type="checkbox"
                checked={preferWeekendsEvenings}
                onChange={(e) => setPreferWeekendsEvenings(e.target.checked)}
                className="suggestions-tab__checkbox rounded border-[#7a7a7a] text-teal-800 focus:ring-teal-700 h-4 w-4"
              />
              <span className="suggestions-tab__checkbox-label text-xs font-mono font-medium text-gray-700 uppercase leading-none">
                Rank Weekends & Evenings First
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={calculateSuggestions}
            className="suggestions-tab__find-btn w-full text-center p-3 font-pixel text-lg retro-button bg-blue-600 text-white border-blue-800 hover:bg-blue-500 mt-4"
          >
            FIND FREE TIMES
          </button>
        </div>

        {/* Suggestion Outputs */}
        <div className="suggestions-tab__panel suggestions-tab__panel--results retro-bevel p-3 rounded md:col-span-1 flex flex-col justify-between min-h-[300px]">
          <div>
            <span className="suggestions-tab__panel-title block text-xs font-mono font-bold text-gray-800 uppercase border-b border-[#999] pb-2 mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-teal-800" />
              3. Overlap Suggestions:
            </span>

            {!searched && (
              <div className="suggestions-tab__results-hint text-center py-12 text-gray-600 font-mono text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto opacity-30 text-teal-950" />
                <p>Select friends & click "Find Free Times" to calculate overlaps.</p>
              </div>
            )}

            {searched && suggestions.length === 0 && (
              <div className="suggestions-tab__results-empty p-4 bg-yellow-50 border border-yellow-300 rounded text-amber-950 text-xs flex gap-2 font-mono">
                <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  No common slot found matching all criteria. Try:
                  <ul className="suggestions-tab__results-empty-list list-disc list-inside mt-1.5 space-y-1 text-[11px] text-amber-900">
                    <li>Reducing selected friends</li>
                    <li>Decreasing minimum duration</li>
                    <li>Changing calendar view week</li>
                  </ul>
                </div>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="suggestions-tab__results-list space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {suggestions.map((s, index) => (
                  <div
                    key={index}
                    className="suggestions-tab__suggestion-card p-2.5 bg-white border-2 border-teal-800/25 hover:border-teal-700 rounded shadow-sm relative group flex flex-col justify-between gap-1"
                  >
                    {/* Rank index tag */}
                    <span className="suggestions-tab__rank absolute top-2 right-2 text-[10px] font-mono font-bold bg-teal-800 text-yellow-300 px-1 rounded">
                      #{index + 1} Best
                    </span>

                    <div className="suggestions-tab__suggestion-main pr-12">
                      <h4 className="suggestions-tab__suggestion-title text-xs font-bold text-teal-950 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-teal-800" />
                        {s.dayOrDate}
                      </h4>
                      <p className="suggestions-tab__suggestion-time text-xs font-mono font-medium text-gray-800 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-600" />
                        {s.start} – {s.end} ({s.durationHours}h block)
                      </p>
                    </div>

                    <div className="suggestions-tab__suggestion-footer flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
                      <span className="suggestions-tab__free-members text-[10px] font-mono text-gray-600">
                        {s.freeMembers.length} free: {s.freeMembers.join(", ")}
                      </span>
                      <button
                        onClick={() => handlePropose(s)}
                        className="suggestions-tab__propose p-1 px-2 text-[10px] font-pixel bg-yellow-400 border border-yellow-600 hover:bg-yellow-300 rounded flex items-center gap-1 text-black font-bold"
                      >
                        <PlusCircle className="w-3 h-3" />
                        Propose
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
