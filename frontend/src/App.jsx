import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Login from "./pages/Login/Login";
import Home from "./pages/Home/Home";
import Tours from "./pages/Tours/Tours";
import Pipeline from "./pages/Pipeline/Pipeline";
import Analytics from "./pages/Analytics/Analytics";
import Admin from "./pages/Admin/Admin";
import Account from "./pages/Account/Account";

import ProtectedRoute from "./features/auth/ProtectedRoute";
import RoleRoute from "./features/auth/RoleRoute";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/tours",
        element: <Tours />,
      },
      {
        path: "/pipeline",
        element: <Pipeline />,
      },
      {
        path: "/analytics",
        element: <Analytics />,
      },
      {
        path: "/account",
        element: <Account />,
      },
      {
        element: <RoleRoute allowedRoles={["super_admin", "admin"]} />,
        children: [
          {
            path: "/admin",
            element: <Admin />,
          },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
