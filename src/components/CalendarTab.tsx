import React, { useState } from "react";
import { Group, Event } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Calendar as CalendarIcon, MapPin, Link, Clock, Check, Users, HelpCircle, XCircle } from "lucide-react";
import "../css/CalendarTab.css";

interface CalendarTabProps {
  group: Group;
  currentUser: string;
  onSyncNeeded: () => void;
}

export default function CalendarTab({ group, currentUser, onSyncNeeded }: CalendarTabProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(group.events[0]?.id || null);

  const selectedEvent = group.events.find((e) => e.id === selectedEventId);

  const handleRSVP = async (eventId: string, status: 'going' | 'maybe' | 'cant') => {
    const updatedEvents = group.events.map((e) => {
      if (e.id === eventId) {
        return {
          ...e,
          RSVPs: {
            ...e.RSVPs,
            [currentUser]: status,
          },
        };
      }
      return e;
    });

    try {
      const docRef = doc(db, "groups", group.groupId);
      updateDoc(docRef, { events: updatedEvents }).catch(err => {
        console.error("Delayed updateDoc error:", err);
      });
      onSyncNeeded();
    } catch (err) {
      console.error("Error RSVPing:", err);
    }
  };

  const getRSVPMembersByStatus = (event: Event, status: 'going' | 'maybe' | 'cant') => {
    return Object.entries(event.RSVPs)
      .filter(([_, value]) => value === status)
      .map(([name]) => group.members.find((m) => m.name === name))
      .filter((m): m is any => !!m);
  };

  const sortedEvents = [...group.events].sort((a, b) => a.datetime.localeCompare(b.datetime));

  return (
    <div className="calendar-tab">
      <div className="calendar-tab__header border-b-2 border-dashed border-[#999] pb-4">
        <h2 className="calendar-tab__title text-2xl font-pixel text-teal-950 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-teal-800" />
          Confirmed Hangouts Calendar
        </h2>
        <p className="calendar-tab__subtitle text-xs text-gray-700 font-mono mt-1">
          RSVP to confirmed meetups and view details. Keep everyone in sync!
        </p>
      </div>

      <div className="calendar-tab__layout grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left column: List of events */}
        <div className="calendar-tab__events-panel md:col-span-5 retro-bevel p-3 rounded space-y-3">
          <span className="calendar-tab__events-title block text-xs font-mono font-bold text-gray-800 uppercase border-b border-[#999] pb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-teal-800" />
            📅 Confirmed Events:
          </span>

          {sortedEvents.length === 0 ? (
            <div className="calendar-tab__events-empty text-center py-16 text-gray-500 font-mono text-xs">
              No confirmed meetups yet. Go to Ideas tab to promote a proposal!
            </div>
          ) : (
            <div className="calendar-tab__events-list space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {sortedEvents.map((event) => {
                const isSelected = event.id === selectedEventId;
                const dateObj = new Date(event.datetime);
                const goingCount = Object.values(event.RSVPs).filter((v) => v === "going").length;

                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`calendar-tab__event-item w-full text-left p-3 border-2 rounded transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? "calendar-tab__event-item--active bg-teal-550 border-teal-600 text-teal-950 font-bold"
                        : "bg-white/80 border-gray-200 text-gray-800 hover:bg-white"
                    }`}
                  >
                    <div>
                      <h3 className="calendar-tab__event-title text-sm font-bold uppercase truncate max-w-[200px]">{event.title}</h3>
                      <p className="calendar-tab__event-time text-xs font-mono text-gray-600 mt-0.5">
                        {dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at{" "}
                        {dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    <div className="calendar-tab__event-meta text-right">
                      <span className="calendar-tab__going-pill text-[10px] font-mono bg-teal-100 text-teal-800 px-1.5 py-0.5 border border-teal-300 rounded font-bold uppercase">
                        {goingCount} Going
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Selected event details */}
        <div className="calendar-tab__details-wrap md:col-span-7">
          {selectedEvent ? (
            <div className="calendar-tab__details retro-bevel p-4 rounded h-full flex flex-col justify-between">
              {/* Event card header */}
              <div className="calendar-tab__details-body space-y-2.5">
                <div className="calendar-tab__details-header border-b-2 border-dotted border-[#808080] pb-3 mb-2 flex items-center justify-between gap-4">
                  <h3 className="calendar-tab__details-title text-xl font-pixel font-bold text-teal-950 uppercase">
                    {selectedEvent.title}
                  </h3>
                  <span className="calendar-tab__confirmed-badge text-[10px] font-mono font-bold bg-[#333] text-yellow-300 px-2 py-0.5 rounded">
                    EVENT STATUS: CONFIRMED
                  </span>
                </div>

                {/* Date & Time with Timezone Converter */}
                <div className="calendar-tab__datetime flex flex-col gap-1.5 font-mono text-xs text-gray-800 bg-white/75 p-3 rounded border border-gray-200 shadow-inner">
                  <div className="calendar-tab__datetime-date flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-700" />
                    <span className="calendar-tab__datetime-date-text font-bold">
                      {new Date(selectedEvent.datetime).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="calendar-tab__datetime-time-row flex items-center gap-2 pl-6">
                    <span className="calendar-tab__datetime-time font-bold text-indigo-900">
                      {new Date(selectedEvent.datetime).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      (Your Local Time)
                    </span>
                  </div>
                </div>

                {/* Location & Links */}
                <div className="calendar-tab__location-grid grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="calendar-tab__location flex items-center gap-2 p-2 bg-white/40 border border-gray-200 rounded text-xs font-mono">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    <div className="calendar-tab__location-text truncate">
                      <span className="font-bold text-gray-700">Where: </span>
                      {selectedEvent.place || "TBD"}
                    </div>
                  </div>

                  {selectedEvent.links ? (
                    <a
                      href={selectedEvent.links}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="calendar-tab__event-link flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs font-mono text-blue-800 underline font-bold"
                    >
                      <Link className="w-4 h-4" />
                      <div>Maps & Tickets Info</div>
                    </a>
                  ) : (
                    <div className="calendar-tab__event-link-disabled flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-500">
                      <Link className="w-4 h-4 opacity-40" />
                      <div>No links added</div>
                    </div>
                  )}
                </div>

                {/* Organizer notes */}
                {selectedEvent.notes && (
                  <div className="calendar-tab__notes p-3 bg-yellow-50 border border-yellow-300 rounded text-xs font-mono text-yellow-950">
                    <span className="calendar-tab__notes-title block font-bold text-yellow-900 mb-1">📢 Coordinator Notes:</span>
                    <p className="calendar-tab__notes-copy leading-relaxed italic">&ldquo;{selectedEvent.notes}&rdquo;</p>
                  </div>
                )}

                {/* RSVPs displays list */}
                <div className="calendar-tab__rsvps border-t border-[#999] pt-3.5 mt-4 space-y-3">
                  <span className="calendar-tab__rsvps-title block text-xs font-mono font-bold text-gray-700 uppercase">
                    👥 RSVPs ({Object.keys(selectedEvent.RSVPs).length} responses):
                  </span>

                  <div className="calendar-tab__rsvps-grid grid grid-cols-3 gap-2">
                    {/* Going */}
                    <div className="calendar-tab__rsvp-card calendar-tab__rsvp-card--going bg-emerald-50/50 p-2.5 rounded border border-emerald-200">
                      <span className="calendar-tab__rsvp-status text-[10px] font-mono font-bold text-emerald-800 uppercase flex items-center gap-1 mb-1.5">
                        <Check className="w-3.5 h-3.5" />
                        Going:
                      </span>
                      <div className="calendar-tab__rsvp-members flex flex-wrap gap-1">
                        {getRSVPMembersByStatus(selectedEvent, "going").map((m) => (
                          <span
                            key={m.name}
                            className="calendar-tab__member-chip text-[10px] font-mono px-1.5 py-0.5 rounded text-white border border-black/10 text-center font-bold"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Maybe */}
                    <div className="calendar-tab__rsvp-card calendar-tab__rsvp-card--maybe bg-amber-50/50 p-2.5 rounded border border-amber-200">
                      <span className="calendar-tab__rsvp-status text-[10px] font-mono font-bold text-amber-800 uppercase flex items-center gap-1 mb-1.5">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Maybe:
                      </span>
                      <div className="calendar-tab__rsvp-members flex flex-wrap gap-1">
                        {getRSVPMembersByStatus(selectedEvent, "maybe").map((m) => (
                          <span
                            key={m.name}
                            className="calendar-tab__member-chip text-[10px] font-mono px-1.5 py-0.5 rounded text-white border border-black/10 text-center font-bold"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Can't */}
                    <div className="calendar-tab__rsvp-card calendar-tab__rsvp-card--cant bg-rose-50/50 p-2.5 rounded border border-rose-200">
                      <span className="calendar-tab__rsvp-status text-[10px] font-mono font-bold text-rose-800 uppercase flex items-center gap-1 mb-1.5">
                        <XCircle className="w-3.5 h-3.5" />
                        Can't:
                      </span>
                      <div className="calendar-tab__rsvp-members flex flex-wrap gap-1">
                        {getRSVPMembersByStatus(selectedEvent, "cant").map((m) => (
                          <span
                            key={m.name}
                            className="calendar-tab__member-chip text-[10px] font-mono px-1.5 py-0.5 rounded text-white border border-black/10 text-center font-bold"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RSVP Action buttons for the current user */}
              <div className="calendar-tab__actions mt-6 pt-3.5 border-t-2 border-dashed border-[#999] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#d4d4d4] p-3 rounded">
                <span className="calendar-tab__actions-label text-xs font-mono font-bold text-gray-800 uppercase flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-800" />
                  Your RSVP Status:
                </span>

                <div className="calendar-tab__actions-buttons flex gap-1.5">
                  <button
                    onClick={() => handleRSVP(selectedEvent.id, "going")}
                    className={`calendar-tab__rsvp-button px-3 py-1.5 text-xs font-bold rounded retro-button ${
                      selectedEvent.RSVPs[currentUser] === "going"
                        ? "calendar-tab__rsvp-button--going bg-emerald-600 text-white border-emerald-950 font-bold"
                        : "bg-white text-black"
                    }`}
                  >
                    Going!
                  </button>
                  <button
                    onClick={() => handleRSVP(selectedEvent.id, "maybe")}
                    className={`calendar-tab__rsvp-button px-3 py-1.5 text-xs font-bold rounded retro-button ${
                      selectedEvent.RSVPs[currentUser] === "maybe"
                        ? "calendar-tab__rsvp-button--maybe bg-amber-400 text-black border-amber-600 font-bold"
                        : "bg-white text-black"
                    }`}
                  >
                    Maybe
                  </button>
                  <button
                    onClick={() => handleRSVP(selectedEvent.id, "cant")}
                    className={`calendar-tab__rsvp-button px-3 py-1.5 text-xs font-bold rounded retro-button ${
                      selectedEvent.RSVPs[currentUser] === "cant"
                        ? "calendar-tab__rsvp-button--cant bg-rose-600 text-white border-rose-950 font-bold"
                        : "bg-white text-black"
                    }`}
                  >
                    Can't
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="calendar-tab__details-empty retro-bevel p-12 rounded text-center text-gray-500 font-mono text-sm h-full flex items-center justify-center border-2 border-dashed border-[#999]">
              Select an event from the list on the left to view coordinates and RSVP.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
