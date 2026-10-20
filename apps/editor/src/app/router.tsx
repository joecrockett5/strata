import { createBrowserRouter } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { HomeRedirect } from "@/features/home/HomeRedirect";
import { WelcomePage } from "@/features/home/WelcomePage";
import { SectionDesignerPage } from "@/features/section-designer/designer/SectionDesignerPage";
import { SectionLibraryPage } from "@/features/section-designer/library/SectionLibraryPage";
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
            <SectionLibraryPage />
          </RequireAuth>
        ),
      },
      {
        path: "designer/sections/:id",
        element: (
          <RequireAuth role="Designer">
            <SectionDesignerPage />
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
