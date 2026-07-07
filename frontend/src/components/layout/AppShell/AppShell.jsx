import "./AppShell.css";

import Sidebar from "../Sidebar";
import TopBanner from "../TopBanner";
import TitleBar from "../TitleBar";
import BottomNavigation from "../BottomNavigation";

function AppShell({ title = "Home", children }) {
  return (
    <div className="app-shell">
      <div className="app-shell__sidebar">
        <Sidebar />
      </div>

      <main className="app-shell__main">
        <div className="app-shell__top-banner">
          <TopBanner />
        </div>

        <TitleBar title={title} />

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
