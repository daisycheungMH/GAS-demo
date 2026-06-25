import { useState, useEffect } from "react";
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db, initAuth } from "./lib/firebase";
import { Group, Idea, Member } from "./types";
import { syncGroupToSheet, syncGroupFromSheet } from "./lib/sheets";
import { getAccessToken } from "./lib/firebase";
import Landing from "./components/Landing";
import AvailabilityTab from "./components/AvailabilityTab";
import SuggestionsTab from "./components/SuggestionsTab";
import IdeasTab from "./components/IdeasTab";
import CalendarTab from "./components/CalendarTab";
import SettingsTab from "./components/SettingsTab";
import { getLocalTimezone } from "./lib/timezone";
import {
  Calendar,
  Users,
  MessageSquare,
  Award,
  Settings as SettingsIcon,
  Sparkles,
  Lock,
  Smile,
  AlertCircle,
  Clock,
  LogOut,
  Bell,
  RefreshCw,
} from "lucide-react";

export default function App() {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [activeTab, setActiveTab] = useState<"availability" | "suggestions" | "ideas" | "calendar" | "settings">(
    "availability"
  );

  // States
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [isOwnerConnected, setIsOwnerConnected] = useState(false);
  const [prefilledProposal, setPrefilledProposal] = useState<Partial<Idea> | null>(null);
  const [freeNowTimer, setFreeNowTimer] = useState<Record<string, number>>({}); // Name -> end Timestamp

  // Check URL/Session on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlGroupId = params.get("group");
    
    const tryGroupId = urlGroupId || localStorage.getItem("meetLesbians_current_groupId");
    if (tryGroupId) {
      const storedMember = localStorage.getItem(`meetLesbians_member_${tryGroupId}`);
      if (storedMember) {
        setGroupId(tryGroupId);
        setMemberName(storedMember);
      } else if (urlGroupId) {
        // Redirect to join form on Landing
        setGroupId(null);
      }
    }

    // Load in-memory Free Now states from localStorage to survive reloads
    const localFreeNow = localStorage.getItem("meetLesbians_freeNow_timers");
    if (localFreeNow) {
      try {
        setFreeNowTimer(JSON.parse(localFreeNow));
      } catch {
        // ignore
      }
    }
  }, []);

  // Listen to Firestore real-time updates for group
  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      return;
    }

    setLoadingGroup(true);
    const docRef = doc(db, "groups", groupId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Group;
          setGroup(data);
        } else {
          console.error("Group does not exist in Firestore.");
          setGroupId(null);
          localStorage.removeItem("meetLesbians_current_groupId");
        }
        setLoadingGroup(false);
      },
      (err) => {
        console.error("Error listening to group document:", err);
        setLoadingGroup(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  // Set up Firebase Auth Google OAuth state listener
  useEffect(() => {
    initAuth(
      (user, token) => {
        setIsOwnerConnected(true);
      },
      () => {
        setIsOwnerConnected(false);
      }
    );
  }, [group]);

  // Handle Free Now ticker countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const updatedTimers = { ...freeNowTimer };

      Object.keys(updatedTimers).forEach((name) => {
        const endTs = updatedTimers[name];
        if (now >= endTs) {
          delete updatedTimers[name];
          changed = true;
        }
      });

      if (changed) {
        setFreeNowTimer(updatedTimers);
        localStorage.setItem("meetLesbians_freeNow_timers", JSON.stringify(updatedTimers));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [freeNowTimer]);

  const handleGroupLoaded = (loadedGroupId: string, activeMemberName: string) => {
    localStorage.setItem("meetLesbians_current_groupId", loadedGroupId);
    setGroupId(loadedGroupId);
    setMemberName(activeMemberName);
    
    // Clear URL query to avoid bookmark loops
    const url = new URL(window.location.href);
    url.searchParams.set("group", loadedGroupId);
    window.history.pushState({}, "", url.toString());
  };

  const handleExitGroup = () => {
    localStorage.removeItem("meetLesbians_current_groupId");
    setGroupId(null);
    setMemberName(null);
    setGroup(null);
    const url = new URL(window.location.origin);
    window.history.pushState({}, "", url.toString());
  };

  // Google Sheets Auto-sync trigger
  const handleAutoSheetsSync = async () => {
    const token = getAccessToken();
    if (!token || !group || !group.sheetId) return;

    try {
      await syncGroupToSheet(token, group.sheetId, {
        name: group.name,
        members: group.members,
        availability: group.availability,
        ideas: group.ideas,
        events: group.events,
      });
    } catch (err) {
      console.error("Auto sheet sync failed:", err);
    }
  };

  // Sync Sheets on Firestore update if we are the owner
  const onSyncNeeded = () => {
    if (isOwnerConnected) {
      handleAutoSheetsSync();
    }
  };

  // Manual Trigger for Sync in settings
  const handleManualSheetSync = async () => {
    const token = getAccessToken();
    if (!token || !group || !group.sheetId) {
      alert("Google connection missing! Please re-login in Settings first.");
      return;
    }

    setIsSyncingSheet(true);
    try {
      // Pull and Merge from sheet
      const sheetData = await syncGroupFromSheet(token, group.sheetId);
      
      // Basic last-write-wins merge
      const updatedGroup = { ...group };
      if (sheetData.members) updatedGroup.members = sheetData.members as any;
      if (sheetData.availability) updatedGroup.availability = sheetData.availability as any;
      if (sheetData.ideas) updatedGroup.ideas = sheetData.ideas as any;
      if (sheetData.events) updatedGroup.events = sheetData.events as any;

      // Update Firestore
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, updatedGroup);

      // Push back fresh
      await syncGroupToSheet(token, group.sheetId, updatedGroup);

      alert("Bidirectional synchronization completed successfully!");
    } catch (err: any) {
      console.error(err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleProposeTime = async (idea: Partial<Idea>) => {
    if (!group) return;

    const newIdea: Idea = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      title: idea.title || "Hangout Proposal",
      suggestedBy: memberName || "Anonymous",
      datetime: idea.datetime || undefined,
      place: idea.place || undefined,
      links: idea.links || undefined,
      notes: idea.notes || undefined,
      votes: memberName ? [memberName] : [],
      signups: memberName ? [memberName] : [],
      attachments: [],
    };

    const updatedIdeas = [newIdea, ...group.ideas];

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { ideas: updatedIdeas });
      onSyncNeeded();
      setPrefilledProposal(null);
      setActiveTab("ideas");
      alert("Hangout suggestion pinned directly to the Ideas Board!");
    } catch (err) {
      console.error("Error direct-creating idea:", err);
    }
  };

  // Free Now Ping trigger
  const handleFreeNowPing = () => {
    if (!memberName) return;
    
    const now = Date.now();
    const isCurrentlyFree = freeNowTimer[memberName] && freeNowTimer[memberName] > now;

    let newTimers;
    if (isCurrentlyFree) {
      newTimers = {
        ...freeNowTimer,
      };
      delete newTimers[memberName];
      setFreeNowTimer(newTimers);
      localStorage.setItem("meetLesbians_freeNow_timers", JSON.stringify(newTimers));
      alert("You are no longer marked as 'Free Now'.");
    } else {
      const durationMs = 2 * 60 * 60 * 1000; // 2 hours
      const endTimestamp = now + durationMs;
      newTimers = {
        ...freeNowTimer,
        [memberName]: endTimestamp,
      };
      setFreeNowTimer(newTimers);
      localStorage.setItem("meetLesbians_freeNow_timers", JSON.stringify(newTimers));
      alert("You've pinned yourself as 'Free Now' for the next 2 hours! Everyone in the group can see.");
    }
  };

  // Gentle nudge copy paste copy helper
  const getNudgeCopy = (): string => {
    if (!group) return "";
    
    // Find members with empty schedules
    const activeMembers = group.members.map((m) => m.name);
    const scheduledMembers = new Set(group.availability.map((a) => a.member));
    const lazyMembers = activeMembers.filter((m) => !scheduledMembers.has(m));

    if (lazyMembers.length === 0) {
      return `Hey! Everyone has painted their calendar availability. Let's find a time! 💖`;
    }

    return `Hey guys! Gentle nudge to paint your calendar slots on meetLesbians so we can plan our next hangout: ${lazyMembers.join(", ")}! 🗓️ ${window.location.origin}/?group=${group.groupId}`;
  };

  const copyNudgeText = () => {
    const text = getNudgeCopy();
    navigator.clipboard.writeText(text);
    alert("Nudge reminder text copied to your clipboard!");
  };

  // Landing view when no group loaded
  if (!groupId || !memberName) {
    return <Landing onGroupLoaded={handleGroupLoaded} />;
  }

  // Retro loading screen
  if (loadingGroup || !group) {
    return (
      <div 
        className="min-h-screen bg-[#111] bg-cover bg-fixed bg-center flex flex-col justify-center items-center font-mono text-white p-4"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&w=1920&q=80')" }}
      >
        <div className="retro-bevel p-6 max-w-sm w-full text-center space-y-4">
          <div className="text-xl font-pixel text-yellow-300 uppercase tracking-wider flex items-center justify-center gap-1">
            <span>::: Loading the gay agenda</span>
            <span className="inline-flex gap-0.5">
              <span className="animate-[bounce_1s_infinite_0ms]">.</span>
              <span className="animate-[bounce_1s_infinite_200ms]">.</span>
              <span className="animate-[bounce_1s_infinite_400ms]">.</span>
            </span>
            <span> :::</span>
          </div>
          {/* Windows 95 Progress bar */}
          <div className="retro-inset p-1 bg-white h-8 relative overflow-hidden flex items-center justify-start">
            <div className="h-full bg-teal-800 animate-[pulse_1.5s_infinite]" style={{ width: "80%" }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800 select-none">
              INITIALIZING SYNC_ENGINE.SYS...
            </div>
          </div>
          <p className="text-[10px] text-gray-200 uppercase tracking-widest">
            retrieving google sheet nodes...
          </p>
        </div>
      </div>
    );
  }

  // Active user's data
  const myData = group.members.find((m) => m.name === memberName);

  return (
    <div 
      className="min-h-screen bg-[#111] bg-cover bg-fixed bg-center p-4 font-sans select-none pb-12"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&w=1920&q=80')" }}
    >
      {/* 1. Master Desktop Title bar */}
      <div className="w-full max-w-7xl mx-auto retro-bevel p-1 shadow-2xl bg-[#c0c0c0] mb-4">
        <div className="retro-window-title flex items-center justify-between p-1.5 px-3 select-none">
          <div className="flex items-center gap-2 font-mono font-bold text-xs md:text-sm tracking-wider uppercase text-white">
            <Calendar className="w-4 h-4 text-yellow-300" />
            meetLesbians - {group.name} (Code: {group.groupId})
          </div>
          <div className="flex gap-2 items-center">
            {isOwnerConnected && (
              <span className="text-[10px] bg-emerald-700 border border-emerald-500 text-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold uppercase animate-pulse">
                Sheet Sync Active
              </span>
            )}
            <a
              href={`https://docs.google.com/spreadsheets/d/${group?.sheetId || "1bHcNP4bJI8-2QSxIS9zSgD4Gay5BYFqa8LbbdWM64bY"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 bg-green-600 border border-green-800 hover:bg-green-500 text-white font-bold text-xs flex items-center gap-1 retro-button cursor-pointer font-pixel"
            >
              Go to GSheets
            </a>
            <button
              onClick={handleExitGroup}
              className="px-2 py-0.5 bg-[#c0c0c0] border border-white text-black font-bold text-xs flex items-center gap-1 hover:bg-[#b0b0b0] retro-button"
            >
              <LogOut className="w-3 h-3 text-red-700" />
              Exit Group
            </button>
          </div>
        </div>

        {/* 2. Geometric Header Banner */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-950 border border-teal-950 p-5 rounded-lg my-2 text-center relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]"></div>
          
          <div className="text-left z-10 relative">
            <h1 className="text-3xl md:text-4xl font-pixel text-yellow-300 tracking-wide drop-shadow">
              meetLesbians
            </h1>
            <p className="text-[10px] font-mono text-teal-200 uppercase tracking-widest mt-0.5">
              ::: {group.name} - join calendar :::
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 z-10 relative">
            {myData && (
              <div className="flex items-center gap-2 bg-black/30 p-1.5 px-3 rounded-full border border-teal-600">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: myData.color }}
                ></span>
                <span className="text-xs font-mono font-bold text-teal-100 uppercase">
                  Logged as: {memberName}
                </span>
              </div>
            )}

            {memberName && (() => {
              const isCurrentlyFree = freeNowTimer[memberName] && freeNowTimer[memberName] > Date.now();
              return (
                <button
                  onClick={handleFreeNowPing}
                  className={`px-2.5 py-1 font-pixel text-[11px] font-bold flex items-center gap-1 rounded shadow retro-button ${
                    isCurrentlyFree
                      ? "bg-yellow-500 hover:bg-yellow-400 border-yellow-700 text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]"
                      : "bg-yellow-400 hover:bg-yellow-300 border-yellow-600 text-black"
                  }`}
                  title={isCurrentlyFree ? "You are marked as Free! Click to toggle off." : "Broadcast to group that you are free now for 2 hours"}
                >
                  <Smile className="w-3.5 h-3.5" />
                  {isCurrentlyFree ? "I'M FREE (ON)" : "I'M FREE NOW"}
                </button>
              );
            })()}
            
            <div className="text-[11px] font-mono text-teal-100 bg-teal-900/80 p-1.5 px-3 rounded border border-teal-700">
              Your TZ: {getLocalTimezone().split("/").pop()?.replace("_", " ")}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Bento Grid Layout */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Bento: Main Tabbed Workspace (65% width, or 100% width if not availability tab) */}
        <div className={`${activeTab === "availability" ? "lg:col-span-8" : "lg:col-span-12"} space-y-4`}>
          <div className="retro-bevel p-1 bg-[#c0c0c0]">
            {/* Retro Desktop Tabs Row */}
            <div className="flex flex-wrap border-b-2 border-[#7a7a7a] mb-4 gap-1 p-1">
              <button
                onClick={() => setActiveTab("availability")}
                className={`px-3.5 py-1.5 font-pixel text-sm md:text-base border-t-2 border-l-2 border-r-2 rounded-t-md transition-all flex items-center gap-1.5 ${
                  activeTab === "availability"
                    ? "bg-[#c0c0c0] border-white text-black font-bold translate-y-[2px]"
                    : "bg-[#a0a0a0] border-[#808080] text-gray-700 hover:bg-[#b0b0b0]"
                }`}
              >
                <Users className="w-4 h-4 text-teal-800" />
                Availability
              </button>

              <button
                onClick={() => setActiveTab("suggestions")}
                className={`px-3.5 py-1.5 font-pixel text-sm md:text-base border-t-2 border-l-2 border-r-2 rounded-t-md transition-all flex items-center gap-1.5 ${
                  activeTab === "suggestions"
                    ? "bg-[#c0c0c0] border-white text-black font-bold translate-y-[2px]"
                    : "bg-[#a0a0a0] border-[#808080] text-gray-700 hover:bg-[#b0b0b0]"
                }`}
              >
                <Award className="w-4 h-4 text-indigo-800" />
                Find Overlaps
              </button>

              <button
                onClick={() => setActiveTab("ideas")}
                className={`px-3.5 py-1.5 font-pixel text-sm md:text-base border-t-2 border-l-2 border-r-2 rounded-t-md transition-all flex items-center gap-1.5 ${
                  activeTab === "ideas"
                    ? "bg-[#c0c0c0] border-white text-black font-bold translate-y-[2px]"
                    : "bg-[#a0a0a0] border-[#808080] text-gray-700 hover:bg-[#b0b0b0]"
                }`}
              >
                <MessageSquare className="w-4 h-4 text-pink-700" />
                Ideas Bucket
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                className={`px-3.5 py-1.5 font-pixel text-sm md:text-base border-t-2 border-l-2 border-r-2 rounded-t-md transition-all flex items-center gap-1.5 ${
                  activeTab === "calendar"
                    ? "bg-[#c0c0c0] border-white text-black font-bold translate-y-[2px]"
                    : "bg-[#a0a0a0] border-[#808080] text-gray-700 hover:bg-[#b0b0b0]"
                }`}
              >
                <Calendar className="w-4 h-4 text-yellow-700" />
                Calendar
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`px-3.5 py-1.5 font-pixel text-sm md:text-base border-t-2 border-l-2 border-r-2 rounded-t-md transition-all flex items-center gap-1.5 ${
                  activeTab === "settings"
                    ? "bg-[#c0c0c0] border-white text-black font-bold translate-y-[2px]"
                    : "bg-[#a0a0a0] border-[#808080] text-gray-700 hover:bg-[#b0b0b0]"
                }`}
              >
                <SettingsIcon className="w-4 h-4 text-gray-700" />
                Settings
              </button>
            </div>

            {/* Active Tab Screen Render - Beautiful White Canvas in Retro Frame */}
            <div className="p-4 bg-white border-2 border-t-[#7a7a7a] border-l-[#7a7a7a] border-r-white border-b-white rounded shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)] text-gray-900">
              {activeTab === "availability" && (
                <AvailabilityTab group={group} currentUser={memberName} onSyncNeeded={onSyncNeeded} />
              )}
              {activeTab === "suggestions" && (
                <SuggestionsTab group={group} currentUser={memberName} onProposeTime={handleProposeTime} />
              )}
              {activeTab === "ideas" && (
                <IdeasTab
                  group={group}
                  currentUser={memberName}
                  prefilledProposal={prefilledProposal}
                  clearPrefilledProposal={() => setPrefilledProposal(null)}
                  onSyncNeeded={onSyncNeeded}
                />
              )}
              {activeTab === "calendar" && (
                <CalendarTab group={group} currentUser={memberName} onSyncNeeded={onSyncNeeded} />
              )}
              {activeTab === "settings" && (
                <SettingsTab
                  group={group}
                  currentUser={memberName}
                  onSyncNeeded={onSyncNeeded}
                  onManualSheetSync={handleManualSheetSync}
                  isSyncingSheet={isSyncingSheet}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Bento: Sidebar Directories & Widgets (35% width) - ONLY rendered on the first page/tab */}
        {activeTab === "availability" && (
          <div className="lg:col-span-4 space-y-4">
            {/* Directory Panel */}
            <div className="retro-bevel p-3 rounded">
              <span className="block text-xs font-mono font-bold text-gray-800 uppercase border-b border-[#999] pb-2 flex items-center gap-1.5 mb-3">
                <Users className="w-4 h-4 text-teal-800" />
                Friends In This Group:
              </span>

              <div className="space-y-2">
                {group.members.map((m) => {
                  const isFreeNow = freeNowTimer[m.name] && freeNowTimer[m.name] > Date.now();
                  const diffSec = isFreeNow ? Math.floor((freeNowTimer[m.name] - Date.now()) / 1000) : 0;
                  const minLeft = Math.ceil(diffSec / 60);

                  return (
                    <div
                      key={m.name}
                      className="flex items-center justify-between p-2.5 bg-white/70 border border-gray-300 rounded font-mono text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                          style={{ backgroundColor: m.color }}
                        ></span>
                        <span className="font-bold text-gray-900">
                          {m.name} {m.name === memberName ? "(You)" : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isFreeNow ? (
                          <span className="text-[9px] bg-green-100 border border-green-500 text-green-800 px-1.5 py-0.5 rounded font-bold animate-pulse">
                            FREE NOW ({minLeft}m)
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-600">
                            {m.timezone.split("/").pop()?.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Privacy statement footer block */}
            <div className="retro-bevel p-3 rounded text-center text-[10px] font-mono text-gray-600 flex items-center justify-center gap-1">
              <Lock className="w-3.5 h-3.5 text-teal-800" />
              Your data lives in your Google Sheet — we don't sell it!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
