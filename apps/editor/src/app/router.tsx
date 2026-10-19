import { createBrowserRouter } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { HomeRedirect } from "@/features/home/HomeRedirect";
import { WelcomePage } from "@/features/home/WelcomePage";
import { AppShell } from "./AppShell";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        path: "designer/sections",
        element: (
          <RequireAuth role="Designer">
            <WelcomePage title="Section library" />
          </RequireAuth>
        ),
      },
      {
        path: "designer/templates",
        element: (
          <RequireAuth role="Designer">
            <WelcomePage title="Starter templates" />
          </RequireAuth>
        ),
      },
      {
        path: "sites",
        element: (
          <RequireAuth role="SiteOwner">
            <WelcomePage title="My sites" />
          </RequireAuth>
        ),
      },
    ],
  },
]);
