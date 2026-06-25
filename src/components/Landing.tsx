import React, { useState, useEffect, useRef } from "react";
import { COMMON_TIMEZONES, getLocalTimezone } from "../lib/timezone";
import { PRESET_COLORS } from "../types";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Calendar, Lock, AlertCircle } from "lucide-react";

interface LandingProps {
  onGroupLoaded: (groupId: string, memberName: string) => void;
}

export default function Landing({ onGroupLoaded }: LandingProps) {
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  
  // Create state
  const [groupName, setGroupName] = useState("");
  const [createMemberName, setCreateMemberName] = useState("");
  const [createColor, setCreateColor] = useState(PRESET_COLORS[0]);
  const [createTimezone, setCreateTimezone] = useState(getLocalTimezone());
  
  // Join state
  const [joinCode, setJoinCode] = useState("");
  const [joinMemberName, setJoinMemberName] = useState("");
  const [joinColor, setJoinColor] = useState(PRESET_COLORS[1]);
  const [joinTimezone, setJoinTimezone] = useState(getLocalTimezone());
  
  // Loader states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // History auto-fill states (only stores the last nickname)
  const [lastNickname, setLastNickname] = useState("");
  const [showCreateNicknameHistory, setShowCreateNicknameHistory] = useState(false);
  const [showJoinNicknameHistory, setShowJoinNicknameHistory] = useState(false);

  // Refs for click outside detection
  const createNicknameRef = useRef<HTMLDivElement | null>(null);
  const joinNicknameRef = useRef<HTMLDivElement | null>(null);

  // Auto-fill from URL query, retrieve history, and setup click outside listeners
  useEffect(() => {
    setLastNickname(localStorage.getItem("meetLesbians_last_nickname") || "");

    const params = new URLSearchParams(window.location.search);
    const code = params.get("group");
    if (code) {
      setJoinCode(code);
      setActiveTab("join");
    }

    function handleClickOutside(event: MouseEvent) {
      if (createNicknameRef.current && !createNicknameRef.current.contains(event.target as Node)) {
        setShowCreateNicknameHistory(false);
      }
      if (joinNicknameRef.current && !joinNicknameRef.current.contains(event.target as Node)) {
        setShowJoinNicknameHistory(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !createMemberName.trim()) {
      setErrorMsg("Please fill out group name and your nickname.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const groupId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const groupDocRef = doc(db, "groups", groupId);
      const newGroupData = {
        groupId,
        name: groupName,
        sheetId: "1bHcNP4bJI8-2QSxIS9zSgD4Gay5BYFqa8LbbdWM64bY",
        sheetOwnerUid: "",
        createdAt: new Date().toISOString(),
        members: [
          {
            name: createMemberName.trim(),
            color: createColor,
            timezone: createTimezone,
          }
        ],
        availability: [],
        ideas: [],
        events: []
      };

      setDoc(groupDocRef, newGroupData).catch((err) => {
        console.error("Delayed setDoc error:", err);
      });
      
      localStorage.setItem("meetLesbians_last_groupName", groupName.trim());
      localStorage.setItem("meetLesbians_last_nickname", createMemberName.trim());
      localStorage.setItem(`meetLesbians_member_${groupId}`, createMemberName.trim());
      onGroupLoaded(groupId, createMemberName.trim());
    } catch (err: any) {
      setErrorMsg("Failed to create group. Please check your internet connection.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinMemberName.trim()) {
      setErrorMsg("Please enter the group code and your nickname.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    const code = joinCode.trim().toUpperCase();

    try {
      const groupDocRef = doc(db, "groups", code);
      const docSnap = await getDoc(groupDocRef);

      if (!docSnap.exists()) {
        setErrorMsg(`Group with code "${code}" not found. Check the code!`);
        setIsLoading(false);
        return;
      }

      const groupData = docSnap.data();
      const existingMembers: any[] = groupData.members || [];
      const isNameTaken = existingMembers.some(
        (m) => m.name.toLowerCase() === joinMemberName.trim().toLowerCase()
      );

      if (isNameTaken) {
        setErrorMsg(`Nickname "${joinMemberName}" is already taken in this group.`);
        setIsLoading(false);
        return;
      }

      const newMember = {
        name: joinMemberName.trim(),
        color: joinColor,
        timezone: joinTimezone,
      };

      updateDoc(groupDocRef, {
        members: arrayUnion(newMember),
      }).catch((err) => {
        console.error("Delayed updateDoc error:", err);
      });

      localStorage.setItem("meetLesbians_last_groupCode", code);
      localStorage.setItem("meetLesbians_last_nickname", joinMemberName.trim());
      localStorage.setItem(`meetLesbians_member_${code}`, joinMemberName.trim());
      onGroupLoaded(code, joinMemberName.trim());
    } catch (err: any) {
      setErrorMsg("Failed to join group. Check connection or code.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#111] bg-cover bg-fixed bg-center p-4 flex flex-col justify-center items-center font-sans"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&w=1920&q=80')" }}
    >
      <div className="w-full max-w-md retro-bevel p-1 shadow-2xl relative">
        {/* Title bar */}
        <div className="retro-window-title flex items-center justify-between p-1.5 px-3 mb-4 select-none">
          <div className="flex items-center gap-2 font-mono font-bold text-sm tracking-wider uppercase">
            <Calendar className="w-4 h-4 text-yellow-300" />
            meetLesbians - the gay agenda
          </div>
          <div className="flex gap-1">
            <button className="w-5 h-5 bg-[#c0c0c0] border border-white text-black font-bold text-xs flex items-center justify-center retro-button" disabled>?</button>
            <button className="w-5 h-5 bg-[#c0c0c0] border border-white text-black font-bold text-xs flex items-center justify-center retro-button" disabled>X</button>
          </div>
        </div>

        {/* Brand Banner */}
        <div className="text-center bg-gradient-to-r from-teal-800 to-teal-900 border border-teal-950 p-6 rounded-lg mb-6 shadow-inner relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]"></div>
          <h1 className="text-4xl md:text-5xl font-pixel text-yellow-300 tracking-wide select-none drop-shadow-md z-10 relative">
            meetLesbians
          </h1>
          <p className="text-xs font-mono text-teal-200 mt-1 tracking-widest uppercase z-10 relative">
            ::: join calendar for small groups :::
          </p>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b-2 border-[#7a7a7a] mb-4 gap-1">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 font-pixel text-lg border-t-2 border-l-2 border-r-2 rounded-t-md transition-all ${
              activeTab === "create"
                ? "bg-[#c0c0c0] border-white text-black font-bold translate-y-[2px]"
                : "bg-[#a0a0a0] border-[#808080] text-gray-700 hover:bg-[#b0b0b0]"
            }`}
          >
            Create Group
          </button>
          <button
            onClick={() => setActiveTab("join")}
            className={`px-4 py-2 font-pixel text-lg border-t-2 border-l-2 border-r-2 rounded-t-md transition-all ${
              activeTab === "join"
                ? "bg-[#c0c0c0] border-white text-black font-bold translate-y-[2px]"
                : "bg-[#a0a0a0] border-[#808080] text-gray-700 hover:bg-[#b0b0b0]"
            }`}
          >
            Join Group
          </button>
        </div>

        {/* Inner white workspace body */}
        <div className="bg-white p-4 border-2 border-t-[#7a7a7a] border-l-[#7a7a7a] border-r-white border-b-white rounded shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]">
          {errorMsg && (
            <div className="bg-red-200 border-2 border-red-600 p-3 mb-4 rounded flex items-start gap-2.5 text-red-950 text-xs font-medium">
              <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {activeTab === "create" ? (
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                  Group Name:
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Wednesday Wine Girls"
                  className="w-full p-2.5 text-sm rounded bg-white border-2 border-[#7a7a7a] focus:outline-none focus:ring-2 focus:ring-teal-600"
                  maxLength={40}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                  Your Nickname:
                </label>
                <div className="relative" ref={createNicknameRef}>
                  <input
                    type="text"
                    value={createMemberName}
                    onChange={(e) => setCreateMemberName(e.target.value)}
                    onFocus={() => setShowCreateNicknameHistory(true)}
                    placeholder="e.g. Daisy"
                    className="w-full p-2.5 text-sm rounded bg-white border-2 border-[#7a7a7a] focus:outline-none focus:ring-2 focus:ring-teal-600"
                    maxLength={20}
                    required
                  />
                  {showCreateNicknameHistory && lastNickname && (
                    <div 
                      onMouseDown={() => {
                        setCreateMemberName(lastNickname);
                        setShowCreateNicknameHistory(false);
                      }}
                      className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#7a7a7a] shadow-lg rounded z-50 p-2 text-xs text-gray-700 cursor-pointer hover:bg-teal-50 flex items-center justify-between font-mono"
                    >
                      <span>💡 Autofill last nickname: <strong className="text-teal-800">{lastNickname}</strong></span>
                      <span className="text-[10px] text-gray-400 font-pixel">CLICK TO FILL</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                    Your Color:
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded border-2 border-[#7a7a7a] h-[82px] overflow-y-auto">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCreateColor(color)}
                        className={`w-6 h-6 rounded border-2 transition-transform ${
                          createColor === color ? "border-black scale-110 shadow" : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                    Timezone:
                  </label>
                  <select
                    value={createTimezone}
                    onChange={(e) => setCreateTimezone(e.target.value)}
                    className="w-full p-2 text-xs rounded bg-white border-2 border-[#7a7a7a] h-[82px]"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.split("/").pop()?.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-teal-50 border-2 border-teal-700/40 rounded-md text-xs text-teal-950 font-mono space-y-1">
                <span className="font-bold flex items-center gap-1 text-teal-800 text-xs">
                  Lore of the King of Lesbians:
                </span>
                <p className="text-[10px] leading-relaxed text-teal-900">
                  Did you know? King James Li, the absolute monarch of the Republic of Lesbians, once declared iced matcha lattes an official currency of the realm.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full text-center p-3 font-pixel text-xl retro-button bg-blue-600 text-white border-blue-800 hover:bg-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-1">
                    CREATING GROUP
                    <span className="inline-flex gap-0.5">
                      <span className="animate-[bounce_1s_infinite_0ms]">.</span>
                      <span className="animate-[bounce_1s_infinite_200ms]">.</span>
                      <span className="animate-[bounce_1s_infinite_400ms]">.</span>
                    </span>
                  </span>
                ) : (
                  "LAUNCH GROUP CALENDAR"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                  Group Short Code:
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDEF"
                  className="w-full p-2.5 text-sm rounded bg-white border-2 border-[#7a7a7a] font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-teal-600"
                  maxLength={8}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                  Your Nickname:
                </label>
                <div className="relative" ref={joinNicknameRef}>
                  <input
                    type="text"
                    value={joinMemberName}
                    onChange={(e) => setJoinMemberName(e.target.value)}
                    onFocus={() => setShowJoinNicknameHistory(true)}
                    placeholder="e.g. Brenda"
                    className="w-full p-2.5 text-sm rounded bg-white border-2 border-[#7a7a7a] focus:outline-none focus:ring-2 focus:ring-teal-600"
                    maxLength={20}
                    required
                  />
                  {showJoinNicknameHistory && lastNickname && (
                    <div 
                      onMouseDown={() => {
                        setJoinMemberName(lastNickname);
                        setShowJoinNicknameHistory(false);
                      }}
                      className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#7a7a7a] shadow-lg rounded z-50 p-2 text-xs text-gray-700 cursor-pointer hover:bg-teal-50 flex items-center justify-between font-mono"
                    >
                      <span>💡 Autofill last nickname: <strong className="text-teal-800">{lastNickname}</strong></span>
                      <span className="text-[10px] text-gray-400 font-pixel">CLICK TO FILL</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                    Your Color:
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded border-2 border-[#7a7a7a] h-[82px] overflow-y-auto">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setJoinColor(color)}
                        className={`w-6 h-6 rounded border-2 transition-transform ${
                          joinColor === color ? "border-black scale-110 shadow" : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                    Timezone:
                  </label>
                  <select
                    value={joinTimezone}
                    onChange={(e) => setJoinTimezone(e.target.value)}
                    className="w-full p-2 text-xs rounded bg-white border-2 border-[#7a7a7a] h-[82px]"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.split("/").pop()?.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border-2 border-yellow-600/40 rounded-md text-xs text-yellow-950 font-mono space-y-1">
                <span className="font-bold flex items-center gap-1 text-yellow-800 text-xs">
                  Law of the Republic of Lesbians:
                </span>
                <p className="text-[10px] leading-relaxed text-yellow-900">
                  Under King James Li's constitution, it is strictly forbidden to arrive at any brunch meeting without a pre-approved PowerPoint presentation summarizing your weekend drama.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full text-center p-3 font-pixel text-xl retro-button bg-blue-600 text-white border-blue-800 hover:bg-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-1">
                    JOINING
                    <span className="inline-flex gap-0.5">
                      <span className="animate-[bounce_1s_infinite_0ms]">.</span>
                      <span className="animate-[bounce_1s_infinite_200ms]">.</span>
                      <span className="animate-[bounce_1s_infinite_400ms]">.</span>
                    </span>
                  </span>
                ) : (
                  "ENTER GROUP CALENDAR"
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info banner */}
        <div className="mt-4 border-t border-[#999] pt-3 text-center text-[10px] font-mono text-gray-600 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3 text-teal-800" />
          meetLesbians - Peer-to-peer group matchmaking.
        </div>
      </div>
    </div>
  );
}
