import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header/Header";
import BottomNavigation from "../components/layout/BottomNavigation/BottomNavigation";

function AppLayout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-content">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
}

export default AppLayout;