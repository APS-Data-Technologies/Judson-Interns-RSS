import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";

import Login from "./pages/Login/Login";
import Home from "./pages/Home/Home";
import Tours from "./pages/Tours/Tours";
import NewTour from "./pages/Tours/NewTour";
import TourPlaceholder from "./pages/Tours/TourPlaceholder";
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
        element: <Navigate to="/home" replace />,
      },
      {
        path: "/home",
        element: <Home />,
      },
      {
        path: "/tours",
        element: <Tours />,
      },
      {
        path: "/tours/new",
        element: <NewTour />,
      },
      {
        path: "/tours/:id",
        element: <TourPlaceholder mode="details" />,
      },
      {
        path: "/tours/:id/edit",
        element: <TourPlaceholder mode="edit" />,
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
        path: "/settings",
        element: <Account />,
      },
      {
        path: "/account",
        element: <Navigate to="/settings" replace />,
      },
      {
        element: <RoleRoute allowedRoles={["super_admin", "admin"]} />,
        children: [
          {
            path: "/admin",
            element: <Admin />,
          },
          {
            path: "/admin/users",
            element: <Admin />,
          },
          {
            path: "/admin/users/new",
            element: <Admin />,
          },
          {
            path: "/admin/users/:id/edit",
            element: <Admin />,
          },
          {
            path: "/admin/locations",
            element: <Admin />,
          },
          {
            path: "/admin/locations/new",
            element: <Admin />,
          },
          {
            path: "/admin/locations/:id/edit",
            element: <Admin />,
          },
          {
            path: "/admin/lead-sources",
            element: <Admin />,
          },
          {
            path: "/admin/lead-sources/new",
            element: <Admin />,
          },
          {
            path: "/admin/lead-sources/:id/edit",
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
