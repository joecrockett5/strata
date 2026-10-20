using System.Globalization;
using Strata.Domain.Content;

namespace Strata.Domain.Publishing;

/// <summary>WCAG 2.x contrast. Mirrors contrast.ts in @strata/schema; both use fixtures/contrast.json.</summary>
public static class Contrast
{
    /// <summary>WCAG AA minimum for normal-size text.</summary>
    public const double AaNormalText = 4.5;

    public static double RelativeLuminance(string hex)
    {
        if (hex.Length != 7 || hex[0] != '#')
        {
            throw new ArgumentException($"Not a #rrggbb colour: {hex}", nameof(hex));
        }

        double Channel(int offset)
        {
            var c = int.Parse(hex.AsSpan(offset, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture) / 255.0;
            return c <= 0.04045 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
        }

        return (0.2126 * Channel(1)) + (0.7152 * Channel(3)) + (0.0722 * Channel(5));
    }

    public static double Ratio(string foreground, string background)
    {
        var a = RelativeLuminance(foreground);
        var b = RelativeLuminance(background);
        return (Math.Max(a, b) + 0.05) / (Math.Min(a, b) + 0.05);
    }

    /// <summary>The pairs the theme editor checks: body text on the background, and onPrimary on primary.</summary>
    public static IReadOnlyList<(string Pair, double Ratio)> ThemePairs(Theme theme) =>
    [
        ("text on background", Ratio(theme.Colors.Text, theme.Colors.Background)),
        ("text on primary", Ratio(theme.Colors.OnPrimary, theme.Colors.Primary)),
    ];
}
