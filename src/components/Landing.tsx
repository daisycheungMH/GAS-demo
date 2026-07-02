import React, { useState, useEffect, useRef } from "react";
import { COMMON_TIMEZONES, getLocalTimezone } from "../lib/timezone";
import { PRESET_COLORS } from "../types";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Calendar, Lock, AlertCircle } from "lucide-react";
import "../css/Landing.css";

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
    <div className="landing-shell font-sans">
      <div className="landing-window retro-bevel">
        {/* Title bar */}
        <div className="landing-titlebar retro-window-title">
          <div className="landing-title">
            <Calendar className="landing-title__icon text-yellow-300" />
            meetLesbians - the gay agenda
          </div>
          <div className="landing-title-actions">
            <button className="landing-title-action retro-button" disabled>?</button>
            <button className="landing-title-action retro-button" disabled>X</button>
          </div>
        </div>

        {/* Brand Banner */}
        <div className="landing-brand">
          <div className="landing-brand__overlay"></div>
          <h1 className="landing-brand__title">
            meetLesbians
          </h1>
          <p className="landing-brand__subtitle">
            ::: join calendar for small groups :::
          </p>
        </div>

        {/* Tab Headers */}
        <div className="landing-tabs">
          <button
            onClick={() => setActiveTab("create")}
            className={`landing-tab ${
              activeTab === "create"
                ? "landing-tab--active"
                : "landing-tab--inactive"
            }`}
          >
            Create Group
          </button>
          <button
            onClick={() => setActiveTab("join")}
            className={`landing-tab ${
              activeTab === "join"
                ? "landing-tab--active"
                : "landing-tab--inactive"
            }`}
          >
            Join Group
          </button>
        </div>

        {/* Inner white workspace body */}
        <div className="landing-body">
          {errorMsg && (
            <div className="landing-error">
              <AlertCircle className="landing-error__icon" />
              <div>{errorMsg}</div>
            </div>
          )}

          {activeTab === "create" ? (
            <form onSubmit={handleCreateGroup} className="app-form">
              <div className="app-field">
                <label className="landing-label">
                  Group Name:
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Wednesday Wine Girls"
                  className="app-input"
                  maxLength={40}
                  required
                />
              </div>

              <div className="app-field">
                <label className="landing-label">
                  Your Nickname:
                </label>
                <div className="landing-nickname-wrap" ref={createNicknameRef}>
                  <input
                    type="text"
                    value={createMemberName}
                    onChange={(e) => setCreateMemberName(e.target.value)}
                    onFocus={() => setShowCreateNicknameHistory(true)}
                    placeholder="e.g. Daisy"
                    className="app-input"
                    maxLength={20}
                    required
                  />
                  {showCreateNicknameHistory && lastNickname && (
                    <div 
                      onMouseDown={() => {
                        setCreateMemberName(lastNickname);
                        setShowCreateNicknameHistory(false);
                      }}
                      className="landing-autofill"
                    >
                      <span className="landing-autofill__main">💡 Autofill last nickname: <strong className="landing-autofill__strong">{lastNickname}</strong></span>
                      <span className="landing-autofill__action">CLICK TO FILL</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="landing-two-col">
                <div className="app-field">
                  <label className="landing-label">
                    Your Color:
                  </label>
                  <div className="landing-color-box">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCreateColor(color)}
                        className={`landing-color-swatch ${
                          createColor === color ? "landing-color-swatch--selected" : "landing-color-swatch--unselected"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="app-field">
                  <label className="landing-label">
                    Timezone:
                  </label>
                  <select
                    value={createTimezone}
                    onChange={(e) => setCreateTimezone(e.target.value)}
                    className="landing-timezone"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.split("/").pop()?.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="landing-note landing-note--create">
                <span className="landing-note__title landing-note__title--create">
                  Lore of the King of Lesbians:
                </span>
                <p className="landing-note__copy landing-note__copy--create">
                  Did you know? King James Li, the absolute monarch of the Republic of Lesbians, once declared iced matcha lattes an official currency of the realm.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="landing-submit retro-button"
              >
                {isLoading ? (
                  <span className="landing-submit__loading">
                    CREATING GROUP
                    <span className="landing-submit__dots">
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
            <form onSubmit={handleJoinGroup} className="app-form">
              <div className="app-field">
                <label className="landing-label">
                  Group Short Code:
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDEF"
                  className="app-input landing-input--code"
                  maxLength={8}
                  required
                />
              </div>

              <div className="app-field">
                <label className="landing-label">
                  Your Nickname:
                </label>
                <div className="landing-nickname-wrap" ref={joinNicknameRef}>
                  <input
                    type="text"
                    value={joinMemberName}
                    onChange={(e) => setJoinMemberName(e.target.value)}
                    onFocus={() => setShowJoinNicknameHistory(true)}
                    placeholder="e.g. Brenda"
                    className="app-input"
                    maxLength={20}
                    required
                  />
                  {showJoinNicknameHistory && lastNickname && (
                    <div 
                      onMouseDown={() => {
                        setJoinMemberName(lastNickname);
                        setShowJoinNicknameHistory(false);
                      }}
                      className="landing-autofill"
                    >
                      <span className="landing-autofill__main">💡 Autofill last nickname: <strong className="landing-autofill__strong">{lastNickname}</strong></span>
                      <span className="landing-autofill__action">CLICK TO FILL</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="landing-two-col">
                <div className="app-field">
                  <label className="landing-label">
                    Your Color:
                  </label>
                  <div className="landing-color-box">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setJoinColor(color)}
                        className={`landing-color-swatch ${
                          joinColor === color ? "landing-color-swatch--selected" : "landing-color-swatch--unselected"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="app-field">
                  <label className="landing-label">
                    Timezone:
                  </label>
                  <select
                    value={joinTimezone}
                    onChange={(e) => setJoinTimezone(e.target.value)}
                    className="landing-timezone"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.split("/").pop()?.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="landing-note landing-note--join">
                <span className="landing-note__title landing-note__title--join">
                  Law of the Republic of Lesbians:
                </span>
                <p className="landing-note__copy landing-note__copy--join">
                  Under King James Li's constitution, it is strictly forbidden to arrive at any brunch meeting without a pre-approved PowerPoint presentation summarizing your weekend drama.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="landing-submit retro-button"
              >
                {isLoading ? (
                  <span className="landing-submit__loading">
                    JOINING
                    <span className="landing-submit__dots">
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
        <div className="landing-footer">
          <Lock className="landing-footer__icon text-teal-800" />
          meetLesbians - Peer-to-peer group matchmaking.
        </div>
      </div>
    </div>
  );
}
