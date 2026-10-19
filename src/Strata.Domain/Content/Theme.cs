namespace Strata.Domain.Content;

public sealed record ThemeColors(
    string Primary,
    string OnPrimary,
    string Secondary,
    string Accent,
    string Background,
    string Surface,
    string Text,
    string MutedText);

public sealed record ThemeFonts(FontStack Heading, FontStack Body);

public sealed record Theme(ThemeColors Colors, ThemeFonts Fonts, ThemeRadius Radius)
{
    public static Theme Default { get; } = new(
        new ThemeColors(
            Primary: "#1f4e5f",
            OnPrimary: "#ffffff",
            Secondary: "#4a6b5d",
            Accent: "#c9822b",
            Background: "#ffffff",
            Surface: "#f3f5f4",
            Text: "#1c2321",
            MutedText: "#55605c"),
        new ThemeFonts(FontStack.Transitional, FontStack.SystemUi),
        ThemeRadius.Small);

    /// <summary>Reads a token's value in a form suitable for equality comparison.</summary>
    public string ValueOf(ThemeToken token) => token switch
    {
        ThemeToken.Primary => Colors.Primary,
        ThemeToken.OnPrimary => Colors.OnPrimary,
        ThemeToken.Secondary => Colors.Secondary,
        ThemeToken.Accent => Colors.Accent,
        ThemeToken.Background => Colors.Background,
        ThemeToken.Surface => Colors.Surface,
        ThemeToken.Text => Colors.Text,
        ThemeToken.MutedText => Colors.MutedText,
        ThemeToken.HeadingFont => Fonts.Heading.ToString(),
        ThemeToken.BodyFont => Fonts.Body.ToString(),
        ThemeToken.Radius => Radius.ToString(),
        _ => throw new ArgumentOutOfRangeException(nameof(token), token, null),
    };
}
