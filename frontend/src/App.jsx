import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Login/Login";
import Home from "./pages/Home/Home";
import Tours from "./pages/Tours/Tours";
import Pipeline from "./pages/Pipeline/Pipeline";
import Analytics from "./pages/Analytics/Analytics";
import Admin from "./pages/Admin/Admin";
import Account from "./pages/Account/Account";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import RoleRoute from "./features/auth/RoleRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/tours" element={<Tours />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/account" element={<Account />} />
            <Route element={<RoleRoute allowedRoles={["super_admin", "admin"]} />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
