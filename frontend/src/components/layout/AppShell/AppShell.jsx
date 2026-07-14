import "./AppShell.css";

import { useNavigate } from "react-router-dom";
import Sidebar from "../Sidebar";
import TopBanner from "../TopBanner";
import TitleBar from "../TitleBar";
import BottomNavigation from "../BottomNavigation";

function AppShell({ title = "Home", children, showBack = false }) {
  const navigate = useNavigate();

  function handleBack() {
    navigate(-1);
  }

  return (
    <div className="app-shell">
      <div className="app-shell__top-banner">
        <TopBanner />
      </div>

      <div className="app-shell__title-bar">
        <TitleBar title={title} onBack={handleBack} showBack={showBack} />
      </div>

      <div className="app-shell__sidebar">
        <Sidebar />
      </div>

      <main className="app-shell__main">
        <section className="app-shell__content">
          {children}
        </section>
      </main>

      <div className="app-shell__bottom-nav">
        <BottomNavigation />
      </div>
    </div>
  );
}

export default AppShell;
