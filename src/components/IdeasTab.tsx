import React, { useState, useEffect } from "react";
import { Group, Idea, Event, IdeaAttachment } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Heart, MessageSquare, Plus, Link, Calendar, MapPin, ArrowRight, Trash2, Filter, ThumbsUp, Paperclip, CheckCircle, Image, ExternalLink, MessageCircle } from "lucide-react";

interface IdeasTabProps {
  group: Group;
  currentUser: string;
  prefilledProposal: Partial<Idea> | null;
  clearPrefilledProposal: () => void;
  onSyncNeeded: () => void;
}

export default function IdeasTab({
  group,
  currentUser,
  prefilledProposal,
  clearPrefilledProposal,
  onSyncNeeded,
}: IdeasTabProps) {
  const [showAddForm, setShowAddForm] = useState(prefilledProposal !== null);
  const [sortBy, setSortBy] = useState<"newest" | "votes" | "upcoming">("newest");
  
  // New Idea Form State
  const [title, setTitle] = useState(prefilledProposal?.title || "");
  const [datetime, setDatetime] = useState(prefilledProposal?.datetime || "");
  const [place, setPlace] = useState(prefilledProposal?.place || "");
  const [links, setLinks] = useState(prefilledProposal?.links || "");
  const [notes, setNotes] = useState(prefilledProposal?.notes || "");

  // Expanded Forum Modal View State
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [uploadType, setUploadType] = useState<'link' | 'photo'>('link');
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [photoName, setPhotoName] = useState("");
  
  // Promoting state inside modal
  const [promoteDateTime, setPromoteDateTime] = useState("");
  const [promotePlace, setPromotePlace] = useState("");

  // Update promotion inputs when active idea changes
  const activeIdea = selectedIdea ? (group.ideas.find(i => i.id === selectedIdea.id) || selectedIdea) : null;

  useEffect(() => {
    if (activeIdea) {
      setPromoteDateTime(activeIdea.datetime || "");
      setPromotePlace(activeIdea.place || "");
    }
  }, [selectedIdea, group.ideas]);

  // Intercept prefills
  useEffect(() => {
    if (prefilledProposal) {
      setTitle(prefilledProposal.title || "");
      setDatetime(prefilledProposal.datetime || "");
      setPlace(prefilledProposal.place || "");
      setLinks(prefilledProposal.links || "");
      setNotes(prefilledProposal.notes || "");
      setShowAddForm(true);
    }
  }, [prefilledProposal]);

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newIdea: Idea = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      title: title.trim(),
      suggestedBy: currentUser,
      datetime: datetime || undefined,
      place: place.trim() || undefined,
      links: links.trim() || undefined,
      notes: notes.trim() || undefined,
      votes: [currentUser], // Initiator votes by default
      signups: [currentUser], // Initiator signed up by default
      attachments: [],
    };

    const updatedIdeas = [newIdea, ...group.ideas];

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { ideas: updatedIdeas });
      
      // Reset form
      setTitle("");
      setDatetime("");
      setPlace("");
      setLinks("");
      setNotes("");
      setShowAddForm(false);
      clearPrefilledProposal();
      onSyncNeeded();
    } catch (err) {
      console.error("Error creating idea:", err);
    }
  };

  const handleVote = async (ideaId: string) => {
    const updatedIdeas = group.ideas.map((idea) => {
      if (idea.id === ideaId) {
        const hasVoted = idea.votes.includes(currentUser);
        const newVotes = hasVoted
          ? idea.votes.filter((v) => v !== currentUser)
          : [...idea.votes, currentUser];
        return { ...idea, votes: newVotes };
      }
      return idea;
    });

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { ideas: updatedIdeas });
      onSyncNeeded();
    } catch (err) {
      console.error("Error voting:", err);
    }
  };

  const handleSignup = async (ideaId: string) => {
    const updatedIdeas = group.ideas.map((idea) => {
      if (idea.id === ideaId) {
        const currentSignups = idea.signups || [];
        const hasSignedUp = currentSignups.includes(currentUser);
        const newSignups = hasSignedUp
          ? currentSignups.filter((v) => v !== currentUser)
          : [...currentSignups, currentUser];
        return { ...idea, signups: newSignups };
      }
      return idea;
    });

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { ideas: updatedIdeas });
      onSyncNeeded();
    } catch (err) {
      console.error("Error updating signups:", err);
    }
  };

  const handleAddAttachment = async (ideaId: string, type: 'link' | 'photo', name: string, url: string) => {
    if (!name.trim() || !url.trim()) {
      alert("Please fill in both a description and paste a valid link/file!");
      return;
    }

    const updatedIdeas = group.ideas.map((idea) => {
      if (idea.id === ideaId) {
        const currentAttachments = idea.attachments || [];
        const newAttachment: IdeaAttachment = {
          id: Math.random().toString(36).substring(2, 9).toUpperCase(),
          type,
          name: name.trim(),
          url: url.trim(),
          addedBy: currentUser,
        };
        return { ...idea, attachments: [...currentAttachments, newAttachment] };
      }
      return idea;
    });

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { ideas: updatedIdeas });
      onSyncNeeded();
    } catch (err) {
      console.error("Error adding attachment:", err);
    }
  };

  const handleDeleteIdea = async (ideaId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering open modal click
    if (!window.confirm("Are you sure you want to delete this proposal?")) return;

    const updatedIdeas = group.ideas.filter((i) => i.id !== ideaId);
    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, { ideas: updatedIdeas });
      onSyncNeeded();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromoteToEvent = async (idea: Idea) => {
    if (!idea.datetime) {
      alert("Please assign a Date & Time to this proposal before confirming!");
      return;
    }

    const confirmPromote = window.confirm(
      `Promote "${idea.title}" to a Confirmed Event on ${idea.datetime.replace("T", " ")}?`
    );
    if (!confirmPromote) return;

    // Create confirmed Event
    const newEvent: Event = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      title: idea.title,
      datetime: idea.datetime,
      place: idea.place || "TBD",
      links: idea.links || "",
      notes: idea.notes || "",
      RSVPs: {
        [idea.suggestedBy]: "going", // Initiator RSVP going
      },
    };

    // Auto-transfer sign-ups to going RSVPs if any
    if (idea.signups) {
      idea.signups.forEach((name) => {
        newEvent.RSVPs[name] = "going";
      });
    }

    // Remove the idea and add the event
    const updatedIdeas = group.ideas.filter((i) => i.id !== idea.id);
    const updatedEvents = [...group.events, newEvent];

    try {
      const docRef = doc(db, "groups", group.groupId);
      await updateDoc(docRef, {
        ideas: updatedIdeas,
        events: updatedEvents,
      });
      onSyncNeeded();
      alert("Successfully promoted! It is now a confirmed event on the Calendar tab.");
    } catch (err) {
      console.error(err);
    }
  };

  // Sort & Filter
  const sortedIdeas = [...group.ideas].sort((a, b) => {
    if (sortBy === "votes") {
      return b.votes.length - a.votes.length;
    }
    if (sortBy === "upcoming") {
      if (!a.datetime) return 1;
      if (!b.datetime) return -1;
      return a.datetime.localeCompare(b.datetime);
    }
    // newest as default
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-dashed border-[#999] pb-4">
        <div>
          <h2 className="text-2xl font-pixel text-teal-950 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-800" />
            Hangout Ideas Bucket
          </h2>
          <p className="text-xs text-gray-700 font-mono mt-1">
            Propose hangouts, sign up, post resources/photos, and promote to the master calendar.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            if (showAddForm) clearPrefilledProposal();
          }}
          className="retro-button p-2.5 text-xs font-bold bg-teal-800 text-white border-teal-950 flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? "Cancel Proposal" : "Propose Hangout Idea"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmitIdea} className="retro-bevel p-4 rounded max-w-lg mx-auto space-y-4">
          <div className="retro-window-title p-1.5 text-xs font-mono font-bold uppercase tracking-wider -mx-4 -mt-4 mb-2 flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            New Hangout Draft Proposal
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
              Hangout Title (Required):
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Board game night & Pizza"
              className="w-full p-2 text-sm rounded bg-white border-2 border-[#7a7a7a]"
              maxLength={50}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                Suggested Date & Time (Optional):
              </label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full p-1.5 text-xs rounded bg-white border-2 border-[#7a7a7a]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                Place / Address (Optional):
              </label>
              <input
                type="text"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="e.g. Daisy's living room"
                className="w-full p-2 text-xs rounded bg-white border-2 border-[#7a7a7a]"
                maxLength={100}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                Website / Maps Link (Optional):
              </label>
              <input
                type="url"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="https://..."
                className="w-full p-2 text-xs rounded bg-white border-2 border-[#7a7a7a]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
                Who Proposes This:
              </label>
              <input
                type="text"
                value={currentUser}
                className="w-full p-2 text-xs rounded bg-gray-100 border-2 border-[#7a7a7a] text-gray-500 font-bold font-mono"
                disabled
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-gray-800 uppercase mb-1">
              Organizer Notes / Description:
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. BYOB! I'll order three vegan pies. Let me know what games to bring!"
              className="w-full p-2 text-xs rounded bg-white border-2 border-[#7a7a7a] h-20 resize-none"
              maxLength={300}
            />
          </div>

          <button
            type="submit"
            className="w-full text-center p-2.5 font-pixel text-lg retro-button bg-blue-600 text-white border-blue-800 hover:bg-blue-500"
          >
            📢 PIN IDEA TO BOARD
          </button>
        </form>
      )}

      {/* Filter / Sort Bar */}
      <div className="flex items-center gap-2 bg-[#dcdcdc] p-2 rounded border border-gray-400">
        <Filter className="w-4 h-4 text-gray-600" />
        <span className="text-xs font-mono font-bold text-gray-700 uppercase">Sort by:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setSortBy("newest")}
            className={`px-3 py-1 text-xs font-bold rounded retro-button ${
              sortBy === "newest" ? "bg-teal-800 text-white border-teal-950" : "bg-white text-black"
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => setSortBy("votes")}
            className={`px-3 py-1 text-xs font-bold rounded retro-button ${
              sortBy === "votes" ? "bg-teal-800 text-white border-teal-950" : "bg-white text-black"
            }`}
          >
            Most Votes
          </button>
          <button
            onClick={() => setSortBy("upcoming")}
            className={`px-3 py-1 text-xs font-bold rounded retro-button ${
              sortBy === "upcoming" ? "bg-teal-800 text-white border-teal-950" : "bg-white text-black"
            }`}
          >
            Upcoming Time
          </button>
        </div>
      </div>

      {/* IDEAS LISTING BOARD AS A FORUM SCROLLABLE COMPONENT */}
      <div className="retro-bevel p-2 rounded bg-[#ececec]">
        <div className="retro-window-title p-1.5 text-xs font-mono font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" />
            Hangout Ideas Board Forum
          </span>
          <span className="text-[10px] text-gray-200">SCROLLABLE ROW WORKSPACE</span>
        </div>

        {sortedIdeas.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-300 rounded">
            <p className="font-mono text-gray-500 text-xs">No hangout proposals currently active on the board.</p>
            <p className="font-mono text-teal-800 text-xs mt-1">Click 'Propose Hangout Idea' above to get started!</p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2">
            {sortedIdeas.map((idea) => {
              const signupCount = idea.signups?.length || 0;
              const hasVoted = idea.votes.includes(currentUser);
              
              return (
                <div
                  key={idea.id}
                  onClick={() => setSelectedIdea(idea)}
                  className="bg-white border border-gray-300 hover:border-teal-700 rounded p-3 cursor-pointer transition-all flex items-center justify-between gap-4 group hover:bg-teal-50/20 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-mono bg-teal-100 text-teal-900 border border-teal-300 px-1 py-0.2 rounded uppercase font-bold">
                        #{idea.id}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-teal-950">
                        {idea.title}
                      </h4>
                    </div>
                    
                    {/* Notes preview */}
                    <p className="text-xs text-gray-600 truncate font-mono mb-1">
                      {idea.notes ? idea.notes : "No description provided."}
                    </p>

                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-gray-500">
                      <span>By: <strong className="text-gray-700">{idea.suggestedBy}</strong></span>
                      {idea.datetime && (
                        <span className="text-indigo-800">| 🗓️ {idea.datetime.replace("T", " ")}</span>
                      )}
                      {idea.place && (
                        <span className="text-emerald-800">| 📍 {idea.place}</span>
                      )}
                    </div>
                  </div>

                  {/* Right sidecar counts & actions */}
                  <div className="flex items-center gap-3">
                    {/* Badge signups & votes */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                        {signupCount} Signups
                      </span>
                      <span className="text-[10px] font-mono bg-teal-100 text-teal-900 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                        {idea.votes.length} Votes
                      </span>
                    </div>

                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(idea.id);
                        }}
                        className={`p-1 text-xs rounded retro-button ${
                          hasVoted ? "bg-rose-100 text-rose-800" : "bg-gray-100 text-black"
                        }`}
                        title="Voted I'm in!"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteIdea(idea.id, e)}
                        className="p-1 text-xs rounded retro-button bg-red-100 text-red-700 hover:text-red-900"
                        title="Delete Idea"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EXPANDED FORUM DETAIL OVERLAY MODAL */}
      {activeIdea && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="retro-bevel bg-[#c0c0c0] w-full max-w-lg p-1 shadow-2xl relative my-8">
            {/* Window title header */}
            <div className="retro-window-title flex items-center justify-between p-1.5 px-3 select-none">
              <span className="font-mono font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-yellow-300" />
                Idea Discussion: #{activeIdea.id}
              </span>
              <button
                onClick={() => setSelectedIdea(null)}
                className="px-1.5 py-0.5 bg-[#c0c0c0] border border-white text-black font-mono font-bold text-xs hover:bg-[#b0b0b0]"
              >
                X
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 text-gray-900 max-h-[80vh] overflow-y-auto">
              <div>
                <h3 className="text-xl font-pixel font-bold text-teal-950 uppercase tracking-wide">
                  {activeIdea.title}
                </h3>
                <p className="text-xs text-gray-600 font-mono mt-0.5">
                  Proposed by <span className="font-bold text-gray-900">{activeIdea.suggestedBy}</span>
                </p>
              </div>

              {/* Description box */}
              <div className="p-3 bg-white border border-gray-300 rounded font-mono text-xs text-gray-800 leading-relaxed max-h-32 overflow-y-auto">
                <strong className="block text-gray-500 uppercase text-[9px] mb-1">Description / Notes:</strong>
                {activeIdea.notes || "No additional description provided."}
              </div>

              {/* Proposal details display */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 bg-white/60 border border-gray-300 rounded">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold">Suggested Date:</span>
                  <span className="font-bold text-gray-800">{activeIdea.datetime ? activeIdea.datetime.replace("T", " ") : "TBD"}</span>
                </div>
                <div className="p-2 bg-white/60 border border-gray-300 rounded">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold">Suggested Place:</span>
                  <span className="font-bold text-gray-800">{activeIdea.place || "TBD"}</span>
                </div>
              </div>

              {/* Support Votes & RSVP sign-ups */}
              <div className="border-t border-gray-300 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold text-gray-800 uppercase flex items-center gap-1">
                    👥 Signed-up Members ({activeIdea.signups?.length || 0}):
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">{activeIdea.votes?.length || 0} Votes</span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-gray-300 rounded min-h-[40px] items-center">
                  {(!activeIdea.signups || activeIdea.signups.length === 0) ? (
                    <span className="text-[10px] text-gray-500 font-mono italic">No one signed up yet. Join the crew!</span>
                  ) : (
                    activeIdea.signups.map((name) => {
                      const color = group.members.find(m => m.name === name)?.color || '#333';
                      return (
                        <span
                          key={name}
                          className="px-2 py-0.5 text-xs rounded font-bold text-white flex items-center gap-1 border border-black/10"
                          style={{ backgroundColor: color }}
                        >
                          {name}
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={() => handleSignup(activeIdea.id)}
                    className={`p-2 text-xs font-pixel rounded retro-button flex items-center justify-center gap-1 ${(activeIdea.signups || []).includes(currentUser) ? "bg-rose-600 text-white border-rose-800 hover:bg-rose-500" : "bg-blue-600 text-white border-blue-800 hover:bg-blue-500"}`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {(activeIdea.signups || []).includes(currentUser) ? "CANCEL RSVP" : "SIGN UP!"}
                  </button>

                  <button
                    onClick={() => handleVote(activeIdea.id)}
                    className={`p-2 text-xs font-pixel rounded retro-button flex items-center justify-center gap-1 ${activeIdea.votes.includes(currentUser) ? "bg-teal-800 text-white border-teal-950" : "bg-white text-black"}`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    {activeIdea.votes.includes(currentUser) ? "SUPPORTED" : "VOTE UP"}
                  </button>
                </div>
              </div>

              {/* Upload Resource or Photo Form Section */}
              <div className="border-t border-gray-300 pt-3">
                <span className="block text-xs font-mono font-bold text-gray-800 uppercase mb-2 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-teal-800" />
                  Shared Resources (Links & Photos)
                </span>

                <div className="bg-white border border-gray-300 p-2 rounded space-y-2 mb-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUploadType('link')}
                      className={`flex-1 p-1 text-[10px] font-bold rounded retro-button ${
                        uploadType === 'link' ? 'bg-teal-800 text-white border-teal-950' : 'bg-gray-100 text-black'
                      }`}
                    >
                      Web Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadType('photo')}
                      className={`flex-1 p-1 text-[10px] font-bold rounded retro-button ${
                        uploadType === 'photo' ? 'bg-teal-800 text-white border-teal-950' : 'bg-gray-100 text-black'
                      }`}
                    >
                      Upload Photo
                    </button>
                  </div>

                  {uploadType === 'link' ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Link Title (e.g. Menu)"
                        value={linkName}
                        onChange={(e) => setLinkName(e.target.value)}
                        className="flex-1 p-1 px-2 text-xs border border-gray-300 rounded bg-white font-mono"
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="flex-1 p-1 px-2 text-xs border border-gray-300 rounded bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!linkUrl) return;
                          handleAddAttachment(activeIdea.id, 'link', linkName || 'Reference Link', linkUrl);
                          setLinkName("");
                          setLinkUrl("");
                        }}
                        className="px-2 py-1 bg-teal-800 text-white text-xs font-bold rounded retro-button"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 font-mono">
                      <input
                        type="text"
                        placeholder="Caption/Label (Optional)"
                        value={photoName}
                        onChange={(e) => setPhotoName(e.target.value)}
                        className="w-full p-1 px-2 text-xs border border-gray-300 rounded bg-white"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 500 * 1024) {
                              alert("Oops! Image must be under 500KB to upload safely.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              handleAddAttachment(activeIdea.id, 'photo', photoName || file.name, reader.result as string);
                              setPhotoName("");
                              e.target.value = ""; // reset file input
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-xs"
                      />
                      <p className="text-[9px] text-gray-500">Max size: 500KB. Standalone image upload store.</p>
                    </div>
                  )}
                </div>

                {/* Attachments rendering lists */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {(!activeIdea.attachments || activeIdea.attachments.length === 0) ? (
                    <p className="text-[10px] text-gray-500 font-mono italic text-center py-2 bg-white/30 rounded border border-dashed border-gray-300">No photos or web resources uploaded yet.</p>
                  ) : (
                    activeIdea.attachments.map((att) => (
                      <div key={att.id} className="p-2 bg-white border border-gray-200 rounded flex items-center justify-between gap-3 text-xs font-mono shadow-sm">
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-gray-900 block truncate flex items-center gap-1">
                            {att.type === 'link' ? <Link className="w-3.5 h-3.5 text-blue-700" /> : <Image className="w-3.5 h-3.5 text-emerald-700" />}
                            {att.name}
                          </span>
                          <span className="text-[9px] text-gray-500 block">Shared by {att.addedBy}</span>
                        </div>
                        <div className="flex-shrink-0">
                          {att.type === 'link' ? (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded flex items-center gap-0.5 border border-indigo-200"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open Link
                            </a>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border border-gray-300 rounded overflow-hidden"
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-12 h-12 object-cover hover:opacity-80 transition-all"
                                />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Convert to Confirmed Event Section */}
              <div className="mt-4 border-t-2 border-dashed border-gray-400 pt-3">
                <span className="block text-xs font-mono font-bold text-gray-800 uppercase mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-yellow-700" />
                  📅 Convert to Confirmed Master Event
                </span>
                <div className="grid grid-cols-2 gap-2 mb-3 font-mono">
                  <div>
                    <label className="block text-[10px] text-gray-700 uppercase mb-0.5 font-bold">Confirmed Date/Time:</label>
                    <input
                      type="datetime-local"
                      value={promoteDateTime}
                      onChange={(e) => setPromoteDateTime(e.target.value)}
                      className="w-full p-1 px-2 text-xs bg-white border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-700 uppercase mb-0.5 font-bold">Confirmed Place:</label>
                    <input
                      type="text"
                      value={promotePlace}
                      onChange={(e) => setPromotePlace(e.target.value)}
                      placeholder="e.g. Daisy's backyard"
                      className="w-full p-1 px-2 text-xs bg-white border border-gray-300 rounded"
                    />
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    if (!promoteDateTime) {
                      alert("Please select a date & time to confirm!");
                      return;
                    }
                    const updatedIdeaForPromo = {
                      ...activeIdea,
                      datetime: promoteDateTime,
                      place: promotePlace,
                    };
                    handlePromoteToEvent(updatedIdeaForPromo);
                    setSelectedIdea(null);
                  }}
                  className="w-full p-2.5 text-xs font-pixel bg-blue-600 border-blue-800 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  <ArrowRight className="w-4 h-4" />
                  PROMOTE TO CONFIRMED EVENT
                </button>
              </div>
            </div>

            {/* Modal footer back to list */}
            <div className="p-2 border-t border-gray-300 bg-gray-100 flex justify-between items-center">
              <button
                onClick={(e) => {
                  handleDeleteIdea(activeIdea.id, e);
                  setSelectedIdea(null);
                }}
                className="px-4 py-1.5 bg-red-100 hover:bg-red-200 border-2 border-red-400 text-red-800 font-bold text-xs retro-button flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Proposal
              </button>
              <button
                onClick={() => setSelectedIdea(null)}
                className="px-4 py-1.5 bg-white border-2 border-[#7a7a7a] text-black font-bold text-xs retro-button"
              >
                Close Forum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
