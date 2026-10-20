import { type FontStack, type Theme, themeContrast, type ThemeTokenPath } from "@strata/schema";
import { AlertTriangle, CheckCircle2, Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { useThemePresets } from "@/lib/themes";
import { colorTokens, useSiteEditor } from "../editorState";
import { isTokenLocked } from "../siteModel";

const colorLabels: Record<(typeof colorTokens)[number], string> = {
  primary: "Primary",
  onPrimary: "Text on primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  surface: "Surface",
  text: "Text",
  mutedText: "Muted text",
};

const fontOptions: readonly { value: FontStack; label: string }[] = [
  { value: "system-ui", label: "System UI" },
  { value: "neo-grotesque", label: "Neo-grotesque" },
  { value: "humanist", label: "Humanist" },
  { value: "geometric-humanist", label: "Geometric humanist" },
  { value: "transitional", label: "Transitional serif" },
  { value: "old-style", label: "Old-style serif" },
];

const contrastLabels: Record<string, string> = {
  "text/background": "Text on background",
  "onPrimary/primary": "Text on primary colour",
};

const hexPattern = /^#[0-9a-f]{6}$/i;

/** Theme tokens. Owners change only tokens the template left unlocked; designers set the locks. */
export function ThemePanel() {
  const { store, author, commands } = useSiteEditor();
  const site = useStore(store, (s) => s.doc.site);
  const presets = useThemePresets();
  const theme = site.theme;
  const locked = (token: ThemeTokenPath) => isTokenLocked(site, token, author);
  const contrast = themeContrast(theme);

  const applyPreset = (preset: Theme) => {
    commands.change("Apply theme preset", (d) => {
      for (const token of colorTokens) {
        if (!locked(`colors.${token}`)) d.theme.colors[token] = preset.colors[token];
      }
      if (!locked("fonts.heading")) d.theme.fonts.heading = preset.fonts.heading;
      if (!locked("fonts.body")) d.theme.fonts.body = preset.fonts.body;
      if (!locked("radius")) d.theme.radius = preset.radius;
    });
  };

  return (
    <div className="space-y-5 p-3" data-testid="theme-panel">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Theme</h2>

      <section aria-label="Contrast" className="space-y-1">
        {contrast.map((check) => (
          <p
            key={check.pair.join("/")}
            role={check.passes ? undefined : "alert"}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              check.passes ? "text-slate-500" : "font-medium text-amber-800",
            )}
            data-testid={`contrast-${check.pair.join("-")}`}
          >
            {check.passes ? (
              <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
            ) : (
              <AlertTriangle className="size-3.5" aria-hidden />
            )}
            {contrastLabels[check.pair.join("/")] ?? check.pair.join(" on ")}: {check.ratio.toFixed(2)}:1
            {check.passes ? "" : " — below WCAG AA (4.5:1)"}
          </p>
        ))}
      </section>

      <section aria-label="Colours" className="space-y-2">
        <h3 className="text-xs font-medium text-slate-600">Colours</h3>
        {colorTokens.map((token) => (
          <ColorRow
            key={token}
            token={`colors.${token}`}
            label={colorLabels[token]}
            value={theme.colors[token]}
            locked={locked(`colors.${token}`)}
            onChange={(value) => {
              commands.change(
                `Change ${colorLabels[token].toLowerCase()} colour`,
                (d) => {
                  d.theme.colors[token] = value;
                },
                `theme:${token}`,
              );
            }}
          />
        ))}
      </section>

      <section aria-label="Fonts" className="space-y-2">
        <h3 className="text-xs font-medium text-slate-600">Fonts</h3>
        {(["heading", "body"] as const).map((role) => (
          <TokenRow
            key={role}
            token={`fonts.${role}`}
            label={role === "heading" ? "Headings" : "Body text"}
            locked={locked(`fonts.${role}`)}
          >
            <Select
              aria-label={role === "heading" ? "Heading font" : "Body font"}
              className="h-8"
              disabled={locked(`fonts.${role}`)}
              value={theme.fonts[role]}
              options={fontOptions}
              onValueChange={(font) => {
                commands.change("Change font", (d) => {
                  d.theme.fonts[role] = font;
                });
              }}
            />
          </TokenRow>
        ))}
      </section>

      <section aria-label="Corners">
        <TokenRow token="radius" label="Corner radius" locked={locked("radius")}>
          <Segmented
            label="Corner radius"
            disabled={locked("radius")}
            value={theme.radius}
            options={[
              { value: "none", label: "None" },
              { value: "small", label: "Small" },
              { value: "large", label: "Large" },
            ]}
            onValueChange={(radius) => {
              commands.change("Change corner radius", (d) => {
                d.theme.radius = radius;
              });
            }}
          />
        </TokenRow>
      </section>

      {presets.data && presets.data.length > 0 ? (
        <section aria-label="Presets" className="space-y-1">
          <h3 className="text-xs font-medium text-slate-600">Start from a preset</h3>
          <div className="flex flex-wrap gap-1">
            {presets.data.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs hover:border-slate-400"
                onClick={() => {
                  applyPreset(preset.theme);
                }}
              >
                <span className="inline-flex">
                  {[
                    preset.theme.colors.primary,
                    preset.theme.colors.secondary,
                    preset.theme.colors.accent,
                  ].map((c) => (
                    <span
                      key={c}
                      className="size-3 rounded-full ring-1 ring-white"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                {preset.name}
              </button>
            ))}
          </div>
          {site.themeLocks.length > 0 && author === "owner" ? (
            <p className="text-xs text-slate-500">Locked tokens keep their values.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** A token row: label, control and either a lock toggle (designers) or a lock indicator (owners). */
function TokenRow({
  token,
  label,
  locked,
  children,
}: {
  token: ThemeTokenPath;
  label: string;
  locked: boolean;
  children: React.ReactNode;
}) {
  const { store, author, commands } = useSiteEditor();
  const lockedInTemplate = useStore(store, (s) => s.doc.site.themeLocks.includes(token));
  return (
    <div className="flex items-center gap-2" data-testid={`token-${token}`}>
      <span className="w-24 shrink-0 text-xs text-slate-700">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {author === "designer" ? (
        <button
          type="button"
          aria-pressed={lockedInTemplate}
          aria-label={`${lockedInTemplate ? "Unlock" : "Lock"} ${label.toLowerCase()} for site owners`}
          title={lockedInTemplate ? "Locked for site owners" : "Owners can change this"}
          onClick={() => {
            commands.setThemeLock(token, !lockedInTemplate);
          }}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded",
            lockedInTemplate ? "bg-slate-900 text-white" : "text-slate-400 hover:bg-slate-100",
          )}
        >
          {lockedInTemplate ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
        </button>
      ) : locked ? (
        <span
          className="inline-flex size-7 items-center justify-center text-slate-500"
          title="Locked by the template (brand setting)"
          aria-label="Locked by the template"
        >
          <Lock className="size-3.5" />
        </span>
      ) : (
        <span className="w-7" />
      )}
    </div>
  );
}

function ColorRow({
  token,
  label,
  value,
  locked,
  onChange,
}: {
  token: ThemeTokenPath;
  label: string;
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  return (
    <TokenRow token={token} label={label} locked={locked}>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={`${label} colour`}
          disabled={locked}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <input
          aria-label={`${label} hex value`}
          disabled={locked}
          value={draft}
          maxLength={7}
          onChange={(e) => {
            setDraft(e.target.value);
            if (hexPattern.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          className={cn(
            "h-8 w-full min-w-0 rounded-md border px-2 font-mono text-xs disabled:bg-slate-100 disabled:text-slate-500",
            hexPattern.test(draft) ? "border-slate-300" : "border-red-500",
          )}
        />
      </div>
    </TokenRow>
  );
}
