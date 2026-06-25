import React, { useState } from "react";
import { Group, PRESET_COLORS } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db, googleSignIn, logout } from "../lib/firebase";
import { createSpreadsheet } from "../lib/sheets";
import { Settings, Copy, Check, FileSpreadsheet, LogIn, LogOut, ShieldAlert, Sparkles, AlertCircle, RefreshCw } from "lucide-react";

interface SettingsTabProps {
  group: Group;
  currentUser: string;
  onSyncNeeded: () => void;
  onManualSheetSync: () => Promise<void>;
  isSyncingSheet: boolean;
}

export default function SettingsTab({
  group,
  currentUser,
  onSyncNeeded,
  onManualSheetSync,
  isSyncingSheet,
}: SettingsTabProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualSheetUrl, setManualSheetUrl] = useState("");

  const handleConnectManualSheet = async () => {
    if (!manualSheetUrl.trim()) return;
    setErrorMsg("");
    setStatusMsg("");
    
    const match = manualSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = match ? match[1] : manualSheetUrl.trim();

    if (!sheetId || sheetId.length < 10) {
      setErrorMsg("Invalid Google Sheet link or ID. Please paste a full Google Sheets URL.");
      return;
    }

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, {
        sheetId: sheetId,
        sheetOwnerUid: "",
      });
      setStatusMsg("Successfully connected the custom Google Sheet! Anyone in the group can sync to it.");
      setManualSheetUrl("");
      onSyncNeeded();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to connect custom Google Sheet: " + err.message);
    }
  };

  const inviteLink = `${window.location.origin}?group=${group.groupId}`;

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLinkGoogleSheet = async () => {
    setIsConnecting(true);
    setErrorMsg("");
    setStatusMsg("");
    try {
      const res = await googleSignIn();
      if (res) {
        setStatusMsg("Google authenticated! Creating group Google Sheet...");
        const newSheetId = await createSpreadsheet(res.accessToken, group.name);
        
        // Update Firestore Group
        const docRef = doc(db, "groups", group.groupId);
        await updateDoc(docRef, {
          sheetId: newSheetId,
          sheetOwnerUid: res.user.uid,
        });

        setStatusMsg("Google Sheet linked successfully! Data is now syncing.");
        onSyncNeeded();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to connect with Google Sheets. Please ensure permissions are granted.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectSheet = async () => {
    if (!window.confirm("Disconnect Google Sheet? Future scheduling updates won't be backed up to Sheets unless reconnected.")) return;

    try {
      await logout();
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, {
        sheetId: "",
        sheetOwnerUid: "",
      });
      setStatusMsg("Disconnected successfully.");
      onSyncNeeded();
    } catch (e) {
      console.error(e);
    }
  };

  const currentUserData = group.members.find((m) => m.name === currentUser);

  const handleUpdateColor = async (color: string) => {
    const updatedMembers = group.members.map((m) => {
      if (m.name === currentUser) {
        return { ...m, color };
      }
      return m;
    });

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { members: updatedMembers });
      onSyncNeeded();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTimezone = async (timezone: string) => {
    const updatedMembers = group.members.map((m) => {
      if (m.name === currentUser) {
        return { ...m, timezone };
      }
      return m;
    });

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { members: updatedMembers });
      onSyncNeeded();
    } catch (e) {
      console.error(e);
    }
  };

  // CSV Exporter Helpers
  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportMembers = () => {
    const headers = ["name", "color", "timezone"];
    const rows = group.members.map(m => [m.name, m.color, m.timezone]);
    downloadCSV(`${group.name}_Members.csv`, headers, rows);
  };

  const exportAvailability = () => {
    const headers = ["member", "date", "start", "end", "status"];
    const rows = group.availability.map(a => [a.member, a.date, a.start, a.end, a.status]);
    downloadCSV(`${group.name}_Availability.csv`, headers, rows);
  };

  const exportIdeas = () => {
    const headers = ["id", "title", "suggested_by", "datetime", "place", "links", "notes", "votes"];
    const rows = group.ideas.map(i => [
      i.id,
      i.title,
      i.suggestedBy,
      i.datetime || "",
      i.place || "",
      i.links || "",
      i.notes || "",
      (i.votes || []).join(",")
    ]);
    downloadCSV(`${group.name}_Ideas.csv`, headers, rows);
  };

  const exportEvents = () => {
    const headers = ["id", "title", "datetime", "place", "links", "notes", "RSVPs"];
    const rows = group.events.map(e => [
      e.id,
      e.title,
      e.datetime,
      e.place || "",
      e.links || "",
      e.notes || "",
      JSON.stringify(e.RSVPs || {})
    ]);
    downloadCSV(`${group.name}_Events.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-dashed border-[#999] pb-4">
        <h2 className="text-2xl font-pixel text-teal-950 flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-800" />
          Settings & Sync Coordinates
        </h2>
        <p className="text-xs text-gray-700 font-mono mt-1">
          Access Master Google Sheets, download instant CSVs, invite group members, or customize your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Google Sheets Integration */}
        <div className="retro-bevel p-4 rounded space-y-4">
          <div className="retro-window-title p-1.5 text-xs font-mono font-bold uppercase tracking-wider -mx-4 -mt-4 mb-2 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-white" />
            Google Sheets & CSV Backups
          </div>

          <div className="bg-teal-50 border-2 border-teal-700/40 p-3 rounded text-xs font-mono text-teal-950 space-y-1.5">
            <div className="font-bold">📋 No Google Account Login Required!</div>
            <p className="text-[11px] leading-relaxed text-teal-900">
              If Google account linking is blocked by your organization's administrator, simply click below to copy the official, beautifully styled Master Google Sheets template to your Drive!
            </p>
            <div className="pt-1">
              <a
                href="https://docs.google.com/spreadsheets/d/1-D2X7l-LhPz8U4yO9Fpxm4X4XWf1NfS_W-Gz_Z1p34E/copy"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 bg-yellow-400 border-2 border-yellow-600 px-3 py-1.5 text-xs font-bold rounded text-black hover:bg-yellow-300 transition-colors retro-button"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Get Master Sheets Template ↗
              </a>
            </div>
          </div>

          {/* Instant CSV Downloader */}
          <div className="space-y-2.5 border-t border-gray-300 pt-3">
            <span className="block text-xs font-bold text-gray-800 font-mono">
              📥 Download Group Tables as CSVs:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportMembers}
                className="p-2 text-xs font-mono font-bold rounded retro-button bg-white text-gray-800 hover:bg-gray-100 text-center"
              >
                Members.csv
              </button>
              <button
                onClick={exportAvailability}
                className="p-2 text-xs font-mono font-bold rounded retro-button bg-white text-gray-800 hover:bg-gray-100 text-center"
              >
                Availability.csv
              </button>
              <button
                onClick={exportIdeas}
                className="p-2 text-xs font-mono font-bold rounded retro-button bg-white text-gray-800 hover:bg-gray-100 text-center"
              >
                Ideas.csv
              </button>
              <button
                onClick={exportEvents}
                className="p-2 text-xs font-mono font-bold rounded retro-button bg-white text-gray-800 hover:bg-gray-100 text-center"
              >
                Events.csv
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="bg-emerald-100 border border-emerald-400 text-emerald-950 p-2 text-xs font-mono rounded">
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-100 border border-red-400 text-red-950 p-2 text-xs font-mono rounded flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Optional Automatic Linkage Section */}
          <div className="border-t border-gray-300 pt-4 space-y-2">
            <span className="block text-xs font-bold text-gray-600 font-mono">
              🔗 Optional Drive Auto-Sync:
            </span>

            {group.sheetId ? (
              <div className="space-y-3">
                <div className="p-2.5 bg-white border border-gray-200 rounded space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-gray-500">AUTO-SYNC ACTIVE:</span>
                    <span className="text-emerald-700 font-bold uppercase flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      ONLINE
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 truncate">
                    <span className="font-bold">ID:</span> {group.sheetId}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${group.sheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 px-2.5 text-[10px] font-bold rounded retro-button bg-teal-800 text-white border-teal-950 flex items-center gap-1"
                  >
                    Open Sheet ↗
                  </a>

                  <button
                    onClick={onManualSheetSync}
                    disabled={isSyncingSheet}
                    className="p-1.5 px-2.5 text-[10px] font-bold rounded retro-button bg-yellow-400 border-yellow-600 hover:bg-yellow-300 text-black flex items-center gap-1 disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingSheet ? "animate-spin" : ""}`} />
                    Sync Now
                  </button>

                  <button
                    onClick={handleDisconnectSheet}
                    className="p-1.5 px-2.5 text-[10px] font-bold rounded retro-button bg-red-50 border-red-200 text-red-800 hover:bg-red-100 flex items-center gap-1 ml-auto"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
                  If your Google account is personal and unrestricted, you can optionally link your Drive to automatically push changes to a dedicated spreadsheet.
                </p>

                <button
                  onClick={handleLinkGoogleSheet}
                  disabled={isConnecting}
                  className="w-full text-center p-2 text-xs font-bold rounded retro-button bg-teal-800 text-white border-teal-950 hover:bg-teal-700 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                  {isConnecting ? "CONNECTING..." : "LINK GOOGLE DRIVE"}
                </button>

                <div className="border-t border-dashed border-gray-400 pt-3 space-y-2">
                  <span className="block text-[10px] font-mono font-bold text-gray-600 uppercase">
                    Or Connect Shared Sheet URL:
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Paste Google Sheets URL here..."
                      value={manualSheetUrl}
                      onChange={(e) => setManualSheetUrl(e.target.value)}
                      className="flex-1 p-1.5 text-xs rounded bg-white border-2 border-[#7a7a7a] font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleConnectManualSheet}
                      className="px-3 py-1.5 text-xs font-bold rounded retro-button bg-blue-600 text-white border-blue-800 hover:bg-blue-500"
                    >
                      Connect
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-500 font-mono leading-tight">
                    Example: Paste your manually created spreadsheet's URL here to use it for data backup.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Invite Links & Profile Controls */}
        <div className="space-y-6">
          {/* Invite Section */}
          <div className="retro-bevel p-4 rounded space-y-3">
            <span className="block text-xs font-mono font-bold text-gray-800 uppercase border-b border-[#999] pb-2">
              📢 Invite Group Friends:
            </span>

            <div className="space-y-3.5">
              {/* Short code */}
              <div>
                <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1">
                  Group Short Code:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={group.groupId}
                    className="flex-1 p-2 bg-gray-100 border-2 border-[#7a7a7a] font-mono font-bold text-center uppercase tracking-widest text-lg rounded text-gray-800"
                    disabled
                  />
                  <button
                    onClick={() => copyToClipboard(group.groupId, setCopiedCode)}
                    className="p-3.5 text-xs font-bold rounded retro-button bg-white text-black flex items-center justify-center"
                    title="Copy Short Code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Direct URL Link */}
              <div>
                <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1">
                  Direct Invite Link:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={inviteLink}
                    className="flex-1 p-2 bg-gray-100 border-2 border-[#7a7a7a] font-mono text-xs rounded text-gray-700 truncate"
                    disabled
                  />
                  <button
                    onClick={() => copyToClipboard(inviteLink, setCopiedLink)}
                    className="p-3 bg-white text-black font-bold rounded retro-button flex items-center justify-center"
                    title="Copy Invite Link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Customization Section */}
          <div className="retro-bevel p-4 rounded space-y-3">
            <span className="block text-xs font-mono font-bold text-gray-800 uppercase border-b border-[#999] pb-2">
              👤 Customize Your Profile Settings:
            </span>

            {currentUserData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Nickname Readonly */}
                  <div>
                    <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1">
                      Your Active Nickname:
                    </label>
                    <input
                      type="text"
                      value={currentUser}
                      className="w-full p-2 bg-gray-100 border-2 border-[#7a7a7a] font-mono font-bold text-gray-700 rounded text-xs"
                      disabled
                    />
                  </div>

                  {/* Timezone Switcher */}
                  <div>
                    <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1">
                      Your Local Timezone:
                    </label>
                    <select
                      value={currentUserData.timezone}
                      onChange={(e) => handleUpdateTimezone(e.target.value)}
                      className="w-full p-2 bg-white border-2 border-[#7a7a7a] text-xs font-mono rounded"
                    >
                      {Intl.supportedValuesOf("timeZone").map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.split("/").pop()?.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Color swatch selection */}
                <div>
                  <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1">
                    Your Color Badge Accent:
                  </label>
                  <div className="flex flex-wrap gap-2 p-2 bg-white rounded border-2 border-[#7a7a7a]">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleUpdateColor(color)}
                        className={`w-7 h-7 rounded border-2 transition-transform ${
                          currentUserData.color === color
                            ? "border-black scale-110 shadow-md"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
