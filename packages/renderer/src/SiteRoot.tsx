import type { Theme } from "@strata/schema";
import type { ReactNode } from "react";
import { themeClasses, themeVariables } from "./classes";

/** The `.st-site` wrapper carrying theme tokens. Mirrors SiteRoot.razor. */
export function SiteRoot({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div className={themeClasses(theme)} style={themeVariables(theme)}>
      {children}
    </div>
  );
}
