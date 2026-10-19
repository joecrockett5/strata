using System.Collections.Concurrent;
using Strata.Domain.Content;

namespace Strata.Rendering;

/// <summary>Class-name helpers. Each mirrors a function in @strata/renderer/src/classes.ts.</summary>
public static class Css
{
    private static readonly ConcurrentDictionary<Enum, string> TokenCache = new();

    /// <summary>Joins non-empty class names (like <c>cx()</c>).</summary>
    public static string Classes(params string?[] parts) => string.Join(' ', parts.Where(p => !string.IsNullOrEmpty(p)));

    /// <summary>The enum's JSON/schema value, e.g. <c>Spacing.Xxl</c> → <c>2xl</c>.</summary>
    public static string Token(Enum value) => TokenCache.GetOrAdd(value, v => ContentJson.Serialize<object>(v).Trim('"'));

    /// <summary>Class-safe form of a ratio: <c>1:2</c> → <c>1-2</c>.</summary>
    public static string Ratio(Enum ratio) => Token(ratio).Replace(':', '-');

    public static string ThemeClasses(Theme theme) => Classes(
        "st-site",
        $"st-radius-{Token(theme.Radius)}",
        $"st-font-heading-{Token(theme.Fonts.Heading)}",
        $"st-font-body-{Token(theme.Fonts.Body)}");

    /// <summary>Theme colours as CSS custom properties (mirrors <c>themeVariables</c>).</summary>
    public static string ThemeVariables(Theme theme)
    {
        var c = theme.Colors;
        (string Name, string Value)[] variables =
        [
            ("--st-color-primary", c.Primary),
            ("--st-color-on-primary", c.OnPrimary),
            ("--st-color-secondary", c.Secondary),
            ("--st-color-accent", c.Accent),
            ("--st-color-background", c.Background),
            ("--st-color-surface", c.Surface),
            ("--st-color-text", c.Text),
            ("--st-color-muted-text", c.MutedText),
        ];
        return string.Join(';', variables.Select(v => $"{v.Name}:{v.Value}"));
    }
}
