import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  MapPin,
  MessageCircle,
  Plus,
  UsersRound,
  X,
} from "lucide-react";

import useAuth from "../../features/auth/useAuth";
import { listTours } from "../../features/tours/tourApi";
import "./ChatAssistant.css";

const roleLabels = {
  staff: "Location assistant",
  admin: "Operations assistant",
  super_admin: "Leadership assistant",
};

function localDate() {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function normalizeTours(data) {
  return Array.isArray(data) ? data : data.results || [];
}

function formatTourSummary(tours, label) {
  if (!tours.length) {
    return `There are no ${label.toLowerCase()} in your accessible workspace.`;
  }

  const preview = tours.slice(0, 3).map((tour) => tour.family_name).join(", ");
  const remainder = tours.length > 3 ? ` and ${tours.length - 3} more` : "";
  return `${tours.length} ${label.toLowerCase()}: ${preview}${remainder}.`;
}

function initialMessage(user) {
  const name = user.first_name || "there";
  return {
    id: "welcome",
    from: "assistant",
    text: `Hi ${name} — I’m your ${roleLabels[user.role] || "workspace assistant"}. I can help you find tours, open the right workspace, and explain common tasks.`,
  };
}

function ChatAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(() => [initialMessage(user)]);
  const [isWorking, setIsWorking] = useState(false);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const isAdmin = ["admin", "super_admin"].includes(user.role);
  const isSuperAdmin = user.role === "super_admin";

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isWorking]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function addAssistantMessage(text, action) {
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-assistant`, from: "assistant", text, action },
    ]);
  }

  async function handleIntent(rawIntent) {
    const intent = rawIntent.trim().toLowerCase();
    if (!intent) return;

    setMessages((current) => [...current, { id: `${Date.now()}-user`, from: "user", text: rawIntent }]);
    setMessage("");

    const today = localDate();
    try {
      if (intent.includes("today") && (intent.includes("tour") || intent.includes("schedule"))) {
        setIsWorking(true);
        const tours = normalizeTours(await listTours({ date: today }));
        addAssistantMessage(formatTourSummary(tours, "Tours today"), { label: "Open tours", to: "/tours" });
      } else if (intent.includes("upcoming") && intent.includes("tour")) {
        setIsWorking(true);
        const tours = normalizeTours(await listTours({ date_from: today }));
        addAssistantMessage(formatTourSummary(tours, "Upcoming tours"), { label: "Open tours", to: "/tours" });
      } else if (intent.includes("no show")) {
        setIsWorking(true);
        const tours = normalizeTours(await listTours({ date_from: today.slice(0, 8) + "01", date_to: today, status: "no_show" }));
        addAssistantMessage(formatTourSummary(tours, "No-shows this month"), { label: "Open analytics", to: "/analytics" });
      } else if (intent.includes("new") && intent.includes("tour")) {
        addAssistantMessage("I’ll take you to the secure tour form. Review the details before saving.", { label: "Create tour", to: "/tours/new" });
      } else if (intent.includes("update") && intent.includes("tour")) {
        addAssistantMessage("Open Tours, select the family, and use the available workflow controls to update contact details, progress, or scheduling.", { label: "Open tours", to: "/tours" });
      } else if (intent.includes("my location") || intent.includes("assigned location")) {
        const locationName = user.location_name || "your assigned location";
        addAssistantMessage(`You are working in ${locationName}. Your tours and operational results are automatically limited to that location.`, { label: "Open settings", to: "/settings" });
      } else if (intent.includes("analytic") || intent.includes("enrollment") || intent.includes("pipeline")) {
        addAssistantMessage("Analytics shows your permitted tour and enrollment activity. Use the filters to focus the results.", { label: "Open analytics", to: "/analytics" });
      } else if (isAdmin && (intent.includes("location") || intent.includes("lead source"))) {
        const target = intent.includes("lead source") ? "/admin/lead-sources" : "/admin/locations";
        addAssistantMessage("I’ll open the administration workspace. Changes there are protected by your administrator permissions.", { label: "Open administration", to: target });
      } else if (isSuperAdmin && (intent.includes("user") || intent.includes("role"))) {
        addAssistantMessage("I’ll open user management. Review every role or account change before you save it.", { label: "Manage users", to: "/admin/users" });
      } else if (intent.includes("help") || intent.includes("what can you do")) {
        addAssistantMessage(`I can help you find tours, review no-shows, open analytics, create a new tour, and explain tour updates.${isAdmin ? " I can also open location and lead-source administration." : ""}${isSuperAdmin ? " I can also open secure user management." : ""}`);
      } else {
        addAssistantMessage("I can help with tours, no-shows, analytics, and workspace navigation. Choose a suggestion below or ask for help.");
      }
    } catch {
      addAssistantMessage("I couldn’t retrieve that information right now. Please try again, or open the workspace directly.");
    } finally {
      setIsWorking(false);
    }
  }

  const suggestions = [
    { label: "My tours today", icon: CalendarDays },
    { label: "Upcoming tours", icon: MessageCircle },
    { label: "No-shows this month", icon: BarChart3 },
    { label: "Create a new tour", icon: Plus },
    { label: "How do I update a tour?", icon: CircleHelp },
    { label: "Open analytics", icon: BarChart3 },
    ...(user.role === "staff" ? [{ label: "My assigned location", icon: MapPin }] : []),
    ...(isAdmin ? [{ label: "Manage locations", icon: MapPin }] : []),
    ...(isAdmin ? [{ label: "Manage lead sources", icon: MessageCircle }] : []),
    ...(isSuperAdmin ? [{ label: "Manage users", icon: UsersRound }] : []),
    { label: "What can you do?", icon: CircleHelp },
  ];

  return (
    <aside className={`chat-assistant ${isOpen ? "chat-assistant--open" : ""}`} aria-label="RSS Assistant">
      {isOpen && (
        <section className="chat-assistant__panel" aria-live="polite">
          <header className="chat-assistant__header">
            <div className="chat-assistant__identity">
              <span className="chat-assistant__bot-icon"><Bot size={19} aria-hidden="true" /></span>
              <div>
                <strong>RSS Assistant</strong>
                <span>{roleLabels[user.role] || "Workspace assistant"}</span>
              </div>
            </div>
            <button className="chat-assistant__close" type="button" onClick={() => setIsOpen(false)} aria-label="Close assistant"><X size={20} /></button>
          </header>

          <div className="chat-assistant__feed" ref={feedRef}>
            {messages.map((item) => (
              <div className={`chat-assistant__message chat-assistant__message--${item.from}`} key={item.id}>
                <p>{item.text}</p>
                {item.action && <button type="button" onClick={() => { navigate(item.action.to); setIsOpen(false); }}>{item.action.label}<ArrowUp size={14} aria-hidden="true" /></button>}
              </div>
            ))}
            {isWorking && <div className="chat-assistant__typing" aria-label="Assistant is working"><span /><span /><span /></div>}
          </div>

          <div className="chat-assistant__suggestions" aria-label="Suggested questions">
            {suggestions.map(({ label, icon: Icon }) => (
              <button type="button" key={label} onClick={() => handleIntent(label)} disabled={isWorking}><Icon size={15} aria-hidden="true" />{label}</button>
            ))}
          </div>
          <form className="chat-assistant__composer" onSubmit={(event) => { event.preventDefault(); handleIntent(message); }}>
            <label className="sr-only" htmlFor="chat-assistant-message">Ask RSS Assistant</label>
            <input ref={inputRef} id="chat-assistant-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about your workspace..." maxLength="240" disabled={isWorking} />
            <button type="submit" disabled={!message.trim() || isWorking} aria-label="Send message"><ArrowUp size={18} /></button>
          </form>
        </section>
      )}
      <button className="chat-assistant__launcher" type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} aria-controls="chat-assistant-message">
        {isOpen ? <ChevronDown size={22} aria-hidden="true" /> : <MessageCircle size={23} aria-hidden="true" />}
        <span>{isOpen ? "Minimize" : "Ask RSS"}</span>
        {!isOpen && <i aria-hidden="true" />}
      </button>
    </aside>
  );
}

export default ChatAssistant;
