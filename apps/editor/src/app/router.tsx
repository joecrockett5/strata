import { createBrowserRouter } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { HomeRedirect } from "@/features/home/HomeRedirect";
import { SectionDesignerPage } from "@/features/section-designer/designer/SectionDesignerPage";
import { SectionLibraryPage } from "@/features/section-designer/library/SectionLibraryPage";
import { NewSitePage } from "@/features/site-editor/sites/NewSitePage";
import { SiteEditorPage } from "@/features/site-editor/sites/SiteEditorPage";
import { SitesPage } from "@/features/site-editor/sites/SitesPage";
import { TemplateEditorPage } from "@/features/site-editor/templates/TemplateEditorPage";
import { TemplatesPage } from "@/features/site-editor/templates/TemplatesPage";
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
            <TemplatesPage />
          </RequireAuth>
        ),
      },
      {
        path: "designer/templates/:id",
        element: (
          <RequireAuth role="Designer">
            <TemplateEditorPage />
          </RequireAuth>
        ),
      },
      {
        path: "sites",
        element: (
          <RequireAuth role="SiteOwner">
            <SitesPage />
          </RequireAuth>
        ),
      },
      {
        path: "sites/new",
        element: (
          <RequireAuth role="SiteOwner">
            <NewSitePage />
          </RequireAuth>
        ),
      },
      {
        path: "sites/:id",
        element: (
          <RequireAuth role="SiteOwner">
            <SiteEditorPage />
          </RequireAuth>
        ),
      },
    ],
  },
]);
