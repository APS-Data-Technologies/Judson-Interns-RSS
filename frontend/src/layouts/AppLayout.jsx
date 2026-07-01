import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";
import BottomNavigation from "../components/layout/BottomNavigation";

function AppLayout() {
  return (
    <div>
      <Header />
      <main>
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
}

export default AppLayout;