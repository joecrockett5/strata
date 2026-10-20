using Strata.Domain.Content;

namespace Strata.Infrastructure.Seeding;

/// <summary>Starter theme presets for designers (section previews, new templates).</summary>
internal static class ThemePresetSeed
{
    public static IReadOnlyList<(string Name, Theme Theme)> All { get; } =
    [
        ("Strata default", Theme.Default),
        ("Coastal", new Theme(
            new ThemeColors(
                Primary: "#0b5d7a",
                OnPrimary: "#ffffff",
                Secondary: "#2f6f73",
                Accent: "#e0a526",
                Background: "#ffffff",
                Surface: "#eef5f7",
                Text: "#10232b",
                MutedText: "#4b5f66"),
            new ThemeFonts(FontStack.GeometricHumanist, FontStack.Humanist),
            ThemeRadius.Large)),
        ("Ink", new Theme(
            new ThemeColors(
                Primary: "#1d1d1f",
                OnPrimary: "#ffffff",
                Secondary: "#5b4b8a",
                Accent: "#b43c0c",
                Background: "#fbfaf7",
                Surface: "#f1eee6",
                Text: "#1d1d1f",
                MutedText: "#5c5a55"),
            new ThemeFonts(FontStack.OldStyle, FontStack.NeoGrotesque),
            ThemeRadius.None)),
    ];
}
