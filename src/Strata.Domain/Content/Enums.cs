using System.Diagnostics.CodeAnalysis;
using System.Text.Json.Serialization;

namespace Strata.Domain.Content;

// Enum member names map to the JSON Schema enum values. Values that are not valid C#
// identifiers use [JsonStringEnumMemberName]. ContentJson registers a camelCase string converter.

public enum Spacing
{
    None,
    Xs,
    Sm,
    Md,
    Lg,
    Xl,
    [JsonStringEnumMemberName("2xl")] Xxl,
}

public enum Align
{
    Start,
    Center,
    End,
}

public enum CrossAlign
{
    Start,
    Center,
    End,
    Stretch,
}

public enum SectionBackground
{
    Background,
    Surface,
    Primary,
}

public enum ContentWidth
{
    Narrow,
    Standard,
    Wide,
    Full,
}

public enum ColumnRatio
{
    [JsonStringEnumMemberName("1")] One,
    [JsonStringEnumMemberName("1:1")] Half,
    [JsonStringEnumMemberName("1:2")] OneTwo,
    [JsonStringEnumMemberName("2:1")] TwoOne,
    [JsonStringEnumMemberName("1:3")] OneThree,
    [JsonStringEnumMemberName("3:1")] ThreeOne,
    [JsonStringEnumMemberName("1:1:1")] Thirds,
    [JsonStringEnumMemberName("1:2:1")] OneTwoOne,
    [JsonStringEnumMemberName("2:1:1")] TwoOneOne,
    [JsonStringEnumMemberName("1:1:2")] OneOneTwo,
    [JsonStringEnumMemberName("1:1:1:1")] Quarters,
}

public enum Breakpoint
{
    Tablet,
    Mobile,
}

public enum ImageAspect
{
    Auto,
    [JsonStringEnumMemberName("1:1")] Square,
    [JsonStringEnumMemberName("4:3")] FourThree,
    [JsonStringEnumMemberName("3:2")] ThreeTwo,
    [JsonStringEnumMemberName("16:9")] SixteenNine,
    [JsonStringEnumMemberName("3:4")] ThreeFour,
}

public enum ImageFit
{
    Cover,
    Contain,
}

public enum ImageRadius
{
    None,
    Theme,
    Full,
}

public enum ButtonVariant
{
    Primary,
    Secondary,
    Link,
}

public enum RepeaterLayout
{
    Stack,
    [JsonStringEnumMemberName("grid-2")] Grid2,
    [JsonStringEnumMemberName("grid-3")] Grid3,
    [JsonStringEnumMemberName("grid-4")] Grid4,
}

public enum SlotMode
{
    Editable,
    Locked,
}

public enum SlotType
{
    Text,
    RichText,
    Image,
    Link,
}

public enum SectionLock
{
    None,
    Required,
    Locked,
}

[SuppressMessage("Naming", "CA1711", Justification = "'Font stack' is the CSS term and the schema name.")]
public enum FontStack
{
    [JsonStringEnumMemberName("system-ui")] SystemUi,
    [JsonStringEnumMemberName("neo-grotesque")] NeoGrotesque,
    Humanist,
    [JsonStringEnumMemberName("geometric-humanist")] GeometricHumanist,
    Transitional,
    [JsonStringEnumMemberName("old-style")] OldStyle,
}

public enum ThemeRadius
{
    None,
    Small,
    Large,
}

public enum ThemeToken
{
    [JsonStringEnumMemberName("colors.primary")] Primary,
    [JsonStringEnumMemberName("colors.onPrimary")] OnPrimary,
    [JsonStringEnumMemberName("colors.secondary")] Secondary,
    [JsonStringEnumMemberName("colors.accent")] Accent,
    [JsonStringEnumMemberName("colors.background")] Background,
    [JsonStringEnumMemberName("colors.surface")] Surface,
    [JsonStringEnumMemberName("colors.text")] Text,
    [JsonStringEnumMemberName("colors.mutedText")] MutedText,
    [JsonStringEnumMemberName("fonts.heading")] HeadingFont,
    [JsonStringEnumMemberName("fonts.body")] BodyFont,
    [JsonStringEnumMemberName("radius")] Radius,
}
