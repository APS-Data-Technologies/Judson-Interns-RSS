import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  GripVertical,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";

import useAuth from "../../features/auth/useAuth";
import { globalSearch } from "../../features/search/globalSearchApi";
import { listTours } from "../../features/tours/tourApi";
import "./ChatAssistant.css";

const searchDestinations = [
  { group: "Pages", title: "Home", keywords: "dashboard start", path: "/home", roles: ["staff", "admin", "super_admin"] },
  { group: "Pages", title: "Tours", keywords: "families schedule", path: "/tours", roles: ["staff", "admin", "super_admin"] },
  { group: "Pages", title: "Pipeline", keywords: "stages follow up", path: "/pipeline", roles: ["staff", "admin", "super_admin"] },
  { group: "Pages", title: "Analytics", keywords: "reports insights", path: "/analytics/overview", roles: ["staff", "admin", "super_admin"] },
  { group: "Pages", title: "Settings", keywords: "account profile", path: "/settings", roles: ["staff", "admin", "super_admin"] },
  { group: "Pages", title: "Admin", keywords: "management", path: "/admin", roles: ["admin", "super_admin"] },
  { group: "Sections", title: "Volume and Trend", keywords: "booked toured enrolled volume", path: "/analytics/volume", roles: ["staff", "admin", "super_admin"], parent: "Analytics" },
  { group: "Sections", title: "Conversion and Cohort", keywords: "conversion rate cohort", path: "/analytics/cohort", roles: ["staff", "admin", "super_admin"], parent: "Analytics" },
  { group: "Sections", title: "Location Insights", keywords: "location performance", path: "/analytics/locations", roles: ["staff", "admin", "super_admin"], parent: "Analytics" },
  { group: "Sections", title: "Lead Source Insights", keywords: "marketing source", path: "/analytics/lead-sources", roles: ["staff", "admin", "super_admin"], parent: "Analytics" },
  { group: "Sections", title: "Staff Insights", keywords: "employee performance", path: "/analytics/staff", roles: ["admin", "super_admin"], parent: "Analytics" },
  { group: "Sections", title: "Costs & Margin", keywords: "revenue financial cost efficiency", path: "/analytics/cost-margin", roles: ["admin", "super_admin"], parent: "Analytics" },
  { group: "Sections", title: "Manage Users", keywords: "roles accounts", path: "/admin/users", roles: ["admin", "super_admin"], parent: "Admin" },
  { group: "Sections", title: "Manage Locations", keywords: "sites", path: "/admin/locations", roles: ["admin", "super_admin"], parent: "Admin" },
  { group: "Sections", title: "Manage Lead Sources", keywords: "marketing sources", path: "/admin/lead-sources", roles: ["admin", "super_admin"], parent: "Admin" },
  { group: "Statuses", title: "Booked", keywords: "status scheduled upcoming", path: "/pipeline?status=scheduled", roles: ["staff", "admin", "super_admin"], parent: "Pipeline" },
  { group: "Statuses", title: "Booked", keywords: "status scheduled upcoming", path: "/tours?status=scheduled", roles: ["staff", "admin", "super_admin"], parent: "Tours" },
  { group: "Statuses", title: "Booked", keywords: "status scheduled upcoming", path: "/analytics/volume?focus=scheduled", roles: ["staff", "admin", "super_admin"], parent: "Analytics › Volume and Trend" },
  { group: "Statuses", title: "Toured", keywords: "status completed tour", path: "/pipeline?status=toured", roles: ["staff", "admin", "super_admin"], parent: "Pipeline" },
  { group: "Statuses", title: "Toured", keywords: "status completed tour", path: "/tours?status=toured", roles: ["staff", "admin", "super_admin"], parent: "Tours" },
  { group: "Statuses", title: "Toured", keywords: "status completed tour", path: "/analytics/volume?focus=toured", roles: ["staff", "admin", "super_admin"], parent: "Analytics › Volume and Trend" },
  { group: "Statuses", title: "No Show", keywords: "status no-show noshow missed", path: "/pipeline?status=no_show", roles: ["staff", "admin", "super_admin"], parent: "Pipeline" },
  { group: "Statuses", title: "No Show", keywords: "status no-show noshow missed", path: "/tours?status=no_show", roles: ["staff", "admin", "super_admin"], parent: "Tours" },
  { group: "Statuses", title: "No Show", keywords: "status no-show noshow missed", path: "/analytics/volume?focus=no_show", roles: ["staff", "admin", "super_admin"], parent: "Analytics › Volume and Trend" },
  { group: "Statuses", title: "Enrolled", keywords: "status enrollment converted", path: "/pipeline?status=enrolled", roles: ["staff", "admin", "super_admin"], parent: "Pipeline" },
  { group: "Statuses", title: "Enrolled", keywords: "status enrollment converted", path: "/tours?status=enrolled", roles: ["staff", "admin", "super_admin"], parent: "Tours" },
  { group: "Statuses", title: "Enrolled", keywords: "status enrollment converted", path: "/analytics/volume?focus=enrolled", roles: ["staff", "admin", "super_admin"], parent: "Analytics › Volume and Trend" },
  { group: "Statuses", title: "Churned", keywords: "status churn lost", path: "/pipeline?status=churned", roles: ["staff", "admin", "super_admin"], parent: "Pipeline" },
  { group: "Statuses", title: "Churned", keywords: "status churn lost", path: "/tours?status=churned", roles: ["staff", "admin", "super_admin"], parent: "Tours" },
  { group: "Statuses", title: "Churned", keywords: "status churn lost", path: "/analytics/volume?focus=churned", roles: ["staff", "admin", "super_admin"], parent: "Analytics › Volume and Trend" },
  { group: "Statuses", title: "Rescheduled", keywords: "status reschedule moved", path: "/tours?status=rescheduled", roles: ["staff", "admin", "super_admin"], parent: "Tours" },
  { group: "Statuses", title: "Cancelled", keywords: "status canceled cancellation", path: "/tours?status=cancelled", roles: ["staff", "admin", "super_admin"], parent: "Tours" },
  { group: "Statuses", title: "Off Track", keywords: "status overdue follow-up awaiting outcome", path: "/pipeline?category=off_track", roles: ["staff", "admin", "super_admin"], parent: "Pipeline" },
  { group: "Statuses", title: "On Track", keywords: "status healthy current", path: "/pipeline?category=on_track", roles: ["staff", "admin", "super_admin"], parent: "Pipeline" },
  { group: "Actions", title: "Create a new tour", keywords: "add book schedule", path: "/tours/new", roles: ["staff", "admin", "super_admin"] },
  { group: "Actions", title: "Review off-track tours", keywords: "follow up overdue outcome", path: "/pipeline", roles: ["staff", "admin", "super_admin"] },
];

const backendGroupLabels = {
  families: "Families",
  tours: "Tours",
  locations: "Locations",
  leadSources: "Lead Sources",
  staff: "Staff",
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
    text: `Hi ${name} — ask me about tours, no-shows, analytics, or navigating RSS.`,
  };
}

function ChatAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [messages, setMessages] = useState(() => [initialMessage(user)]);
  const [isWorking, setIsWorking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const assistantRef = useRef(null);
  const dragRef = useRef(null);
  const didDragRef = useRef(false);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const isAdmin = ["admin", "super_admin"].includes(user.role);
  const isSuperAdmin = user.role === "super_admin";

  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = assistantRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    didDragRef.current = false;
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, rect };
  }

  function moveDrag(event) {
    if (!dragRef.current) return;
    const { pointerX, pointerY, rect } = dragRef.current;
    const rawX = event.clientX - pointerX;
    const rawY = event.clientY - pointerY;
    const deltaX = Math.min(window.innerWidth - 8 - rect.right, Math.max(8 - rect.left, rawX));
    const deltaY = Math.min(window.innerHeight - 8 - rect.bottom, Math.max(8 - rect.top, rawY));
    if (Math.abs(rawX) > 4 || Math.abs(rawY) > 4) didDragRef.current = true;
    setPosition((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      rect: { ...rect, left: rect.left + deltaX, right: rect.right + deltaX, top: rect.top + deltaY, bottom: rect.bottom + deltaY },
    };
  }

  function endDrag(event) {
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  function toggleAssistant() {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setIsOpen((current) => !current);
  }

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        setSearchResults(await globalSearch(query, controller.signal));
      } catch (error) {
        if (error.name !== "CanceledError" && error.code !== "ERR_CANCELED") setSearchResults({});
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 140);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

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
    const intent = rawIntent.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!intent) return;

    setActiveView("chat");
    setMessages((current) => [...current, { id: `${Date.now()}-user`, from: "user", text: rawIntent }]);
    setSearchQuery("");
    setSearchResults({});

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
      } else if (intent.includes("overdue") || intent.includes("follow up")) {
        addAssistantMessage("Review the off-track pipeline for tours that need follow-up or an outcome.", { label: "Review follow-ups", to: "/pipeline?category=off_track" });
      } else if (intent.includes("no show") || intent.includes("noshow")) {
        setIsWorking(true);
        const tours = normalizeTours(await listTours({ date_from: today.slice(0, 8) + "01", date_to: today, status: "no_show" }));
        addAssistantMessage(formatTourSummary(tours, "No-shows this month"), { label: "Review no-shows", to: "/tours?status=no_show" });
      } else if (intent.includes("record") && intent.includes("outcome")) {
        addAssistantMessage("Open the tour, then record its latest outcome and follow-up details.", { label: "Open tours", to: "/tours" });
      } else if (intent.includes("new") && intent.includes("tour")) {
        addAssistantMessage("I’ll take you to the secure tour form. Review the details before saving.", { label: "Create tour", to: "/tours/new" });
      } else if (intent.includes("find") && (intent.includes("family") || intent.includes("tour"))) {
        addAssistantMessage("Use the field below to search by family or tour details, then select a matching result.");
      } else if (intent.includes("update") && intent.includes("tour")) {
        addAssistantMessage("Open Tours, select the family, and use the available workflow controls to update contact details, progress, or scheduling.", { label: "Open tours", to: "/tours" });
      } else if (intent.includes("enrollment performance")) {
        addAssistantMessage("Review current enrollment outcomes and headline performance metrics.", { label: "Review performance", to: "/analytics/overview" });
      } else if (intent.includes("conversion trend")) {
        addAssistantMessage("Compare conversion performance across time and cohorts.", { label: "Compare trends", to: "/analytics/cohort" });
      } else if (intent.includes("location performance")) {
        addAssistantMessage("Review location-level performance within your permitted scope.", { label: "Compare locations", to: "/analytics/locations" });
      } else if (isAdmin && intent.includes("analyze lead source")) {
        addAssistantMessage("Compare lead-source volume and conversion performance.", { label: "Analyze lead sources", to: "/analytics/lead-sources" });
      } else if (isAdmin && intent.includes("staff performance")) {
        addAssistantMessage("Review staff-level activity and conversion performance.", { label: "Review staff", to: "/analytics/staff" });
      } else if (isAdmin && (intent.includes("cost") || intent.includes("margin"))) {
        addAssistantMessage("Review costs, revenue, and margin performance.", { label: "Review costs and margins", to: "/analytics/cost-margin" });
      } else if (intent.includes("enrollment pipeline")) {
        addAssistantMessage("Review tours by pipeline stage and identify records needing attention.", { label: "Open pipeline", to: "/pipeline" });
      } else if (intent.includes("my location") || intent.includes("assigned location")) {
        const locationName = user.location_name || "your assigned location";
        addAssistantMessage(`You are working in ${locationName}. Your tours and operational results are automatically limited to that location.`, { label: "Open settings", to: "/settings" });
      } else if (isSuperAdmin && intent.includes("manage user")) {
        addAssistantMessage("I’ll open user management. Review every role or account change before you save it.", { label: "Manage users", to: "/admin/users" });
      } else if (isAdmin && intent.includes("manage") && (intent.includes("location") || intent.includes("lead source"))) {
        const target = intent.includes("lead source") ? "/admin/lead-sources" : "/admin/locations";
        addAssistantMessage("I’ll open the administration workspace. Changes there are protected by your administrator permissions.", { label: "Open administration", to: target });
      } else if (intent.includes("analytic") || intent.includes("enrollment") || intent.includes("pipeline")) {
        addAssistantMessage("Analytics shows your permitted tour and enrollment activity. Use the filters to focus the results.", { label: "Open analytics", to: "/analytics" });
      } else if (intent.includes("help") || intent.includes("what can you do") || intent.includes("what can rss")) {
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
    { label: "View today’s tours", icon: CalendarDays, group: "today", to: `/tours?date=${localDate()}` },
    { label: "Review upcoming tours", icon: MessageCircle, group: "today", to: "/tours" },
    { label: "Review overdue follow-ups", icon: CircleHelp, group: "today", to: "/pipeline?category=off_track" },
    { label: "Record a tour outcome", icon: Plus, group: "today", to: "/tours" },
    { label: "Create a new tour", icon: Plus, group: "tours", to: "/tours/new" },
    { label: "Find a family or tour", icon: Search, group: "tours", to: "/tours" },
    { label: "Review no-shows", icon: BarChart3, group: "tours", to: "/tours?status=no_show" },
    { label: "View the enrollment pipeline", icon: BarChart3, group: "tours", to: "/pipeline" },
    { label: "Review enrollment performance", icon: BarChart3, group: "analytics", to: "/analytics/overview" },
    { label: "Compare conversion trends", icon: BarChart3, group: "analytics", to: "/analytics/cohort" },
    { label: "Compare location performance", icon: MapPin, group: "analytics", to: "/analytics/locations" },
    ...(isAdmin ? [{ label: "Analyze lead sources", icon: MessageCircle, group: "analytics", to: "/analytics/lead-sources" }] : []),
    ...(isAdmin ? [{ label: "Review staff performance", icon: UsersRound, group: "analytics", to: "/analytics/staff" }] : []),
    ...(isAdmin ? [{ label: "Review costs and margins", icon: BarChart3, group: "analytics", to: "/analytics/cost-margin" }] : []),
    ...(isAdmin ? [{ label: "Manage locations", icon: MapPin, group: "administration", to: "/admin/locations" }] : []),
    ...(isAdmin ? [{ label: "Manage lead sources", icon: MessageCircle, group: "administration", to: "/admin/lead-sources" }] : []),
    ...(isSuperAdmin ? [{ label: "Manage users", icon: UsersRound, group: "administration", to: "/admin/users" }] : []),
    { label: "How do I update a tour?", icon: CircleHelp, group: "help" },
    { label: "What can RSS Assistant do?", icon: CircleHelp, group: "help" },
  ];
  const suggestionGroupLabels = {
    today: "Today",
    tours: "Tours",
    analytics: "Analytics",
    administration: "Administration",
    help: "Help",
  };
  const suggestionGroups = Object.keys(suggestionGroupLabels)
    .map((group) => {
      const items = suggestions.filter((item) => item.group === group);
      return { group, items };
    })
    .filter(({ items }) => items.length);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const isWelcomeState = messages.length === 1 && messages[0].id === "welcome";
  const staticGroups = searchDestinations
    .filter((item) => item.roles.includes(user.role))
    .filter((item) => normalizedSearch.length >= 2 && `${item.title} ${item.keywords} ${item.parent || ""}`.toLowerCase().includes(normalizedSearch))
    .reduce((groups, item) => ({ ...groups, [item.group]: [...(groups[item.group] || []), item] }), {});
  const resultGroups = [
    ...Object.entries(staticGroups).map(([label, items]) => ({ label, items: items.slice(0, label === "Statuses" ? 20 : 5) })),
    ...Object.entries(backendGroupLabels).map(([key, label]) => ({ label, items: searchResults[key] || [] })),
  ].filter((group) => group.items.length);

  function openSearchResult(result) {
    navigate(result.path);
    setSearchQuery("");
    setIsOpen(false);
  }

  function openShortcut(shortcut) {
    if (!shortcut.to) {
      handleIntent(shortcut.label);
      return;
    }
    navigate(shortcut.to);
    setSearchQuery("");
    setSearchResults({});
    setIsOpen(false);
  }

  return (
    <aside className={`chat-assistant ${isOpen ? "chat-assistant--open" : ""}`} aria-label="RSS Assistant" ref={assistantRef} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}>
      {isOpen && (
        <section className={`chat-assistant__panel ${isWelcomeState ? "chat-assistant__panel--welcome" : ""}`} aria-live="polite">
          <header className="chat-assistant__header" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <div className="chat-assistant__identity">
              <Bot className="chat-assistant__bot-icon" size={30} aria-hidden="true" />
              <div>
                <strong>RSS Assistant</strong>
              </div>
            </div>
            <div className="chat-assistant__header-actions">
              <span className="chat-assistant__drag-handle" aria-label="Drag to move assistant"><GripVertical size={18} aria-hidden="true" /></span>
              <button className="chat-assistant__close" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setIsOpen(false)} aria-label="Close assistant"><X size={20} /></button>
            </div>
          </header>

          <div className="chat-assistant__tabs" role="tablist" aria-label="Assistant views">
            <button aria-selected={activeView === "chat"} className={activeView === "chat" ? "is-active" : ""} onClick={() => setActiveView("chat")} role="tab" type="button">Chat</button>
            <button aria-selected={activeView === "shortcuts"} className={activeView === "shortcuts" ? "is-active" : ""} onClick={() => setActiveView("shortcuts")} role="tab" type="button">Shortcuts</button>
          </div>

          {activeView === "chat" && <div className="chat-assistant__feed" ref={feedRef} role="tabpanel">
            {isWelcomeState && <div className="chat-assistant__welcome">
              <Bot aria-hidden="true" />
              <strong>Hi {user.first_name || "there"}, how can I help?</strong>
            </div>}
            {messages.filter((item) => item.id !== "welcome").map((item) => (
              <div className={`chat-assistant__message chat-assistant__message--${item.from}`} key={item.id}>
                <p>{item.text}</p>
                {item.action && <button type="button" onClick={() => { navigate(item.action.to); setIsOpen(false); }}>{item.action.label}<ArrowUp size={14} aria-hidden="true" /></button>}
              </div>
            ))}
            {isWorking && <div className="chat-assistant__typing" aria-label="Assistant is working"><span /><span /><span /></div>}
          </div>}

          {activeView === "shortcuts" && <div className="chat-assistant__suggestions" aria-label="Suggested questions" role="tabpanel">
            {suggestionGroups.map(({ group, items }) => <section className="chat-assistant__suggestion-group" key={group}>
              <h3>{suggestionGroupLabels[group]}</h3>
              <div>
                {items.map((shortcut) => {
                  const { label, icon: Icon } = shortcut;
                  return (
                    <button type="button" key={label} onClick={() => openShortcut(shortcut)} disabled={isWorking}><Icon size={15} aria-hidden="true" />{label}</button>
                  );
                })}
              </div>
            </section>)}
          </div>}

          {activeView === "chat" && <div className="chat-assistant__input-area">
            {normalizedSearch.length >= 2 && <div className="chat-assistant__search-results">
              {resultGroups.length ? resultGroups.map((group) => <section key={group.label}><h3>{group.label}</h3>{group.items.map((result) => <button key={`${group.label}-${result.id || result.path}-${result.title}`} onClick={() => openSearchResult(result)} type="button"><span><strong>{result.title}</strong><small>{result.parent ? `${result.parent} › ${result.title}` : result.subtitle || group.label.slice(0, -1)}</small></span><ArrowUp aria-hidden="true" /></button>)}</section>) : !isSearching && <p>No matching destinations or records.</p>}
            </div>}
            <form className="chat-assistant__composer" onSubmit={(event) => { event.preventDefault(); handleIntent(searchQuery); }}>
              <label htmlFor="chat-assistant-message">{isSearching ? <LoaderCircle aria-label="Searching" className="chat-assistant__search-spinner" /> : <Search aria-hidden="true" />}<span className="sr-only">Ask or search RSS</span></label>
              <input
                autoComplete="off"
                ref={inputRef}
                id="chat-assistant-message"
                value={searchQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchQuery(value);
                  if (value.trim().length < 2) {
                    setSearchResults({});
                    setIsSearching(false);
                  }
                }}
                placeholder="Ask or search RSS…"
                maxLength="240"
                disabled={isWorking}
              />
              <button type="submit" disabled={!searchQuery.trim() || isWorking} aria-label="Send message"><ArrowUp size={18} /></button>
            </form>
          </div>}
        </section>
      )}
      <button className="chat-assistant__launcher" type="button" onClick={toggleAssistant} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} aria-label={isOpen ? "Minimize RSS Assistant" : "Open RSS Assistant"} aria-expanded={isOpen} aria-controls="chat-assistant-message">
        {isOpen ? <ChevronDown size={22} aria-hidden="true" /> : <MessageCircle size={23} aria-hidden="true" />}
        <span>{isOpen ? "Minimize" : "Ask RSS"}</span>
        {!isOpen && <i aria-hidden="true" />}
      </button>
    </aside>
  );
}

export default ChatAssistant;
