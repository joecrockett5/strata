using Strata.Domain.Content;

namespace Strata.Domain.Templates;

/// <summary>A named theme designers can preview sections with and start templates from.</summary>
public sealed class ThemePreset
{
    private ThemePreset()
    {
    }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public Theme Theme { get; private set; } = null!;
    public DateTimeOffset UpdatedAt { get; private set; }

    public static ThemePreset Create(string name, Theme theme, DateTimeOffset now) => new()
    {
        Id = Guid.CreateVersion7(now),
        Name = name,
        Theme = theme,
        UpdatedAt = now,
    };

    public void Update(string name, Theme theme, DateTimeOffset now)
    {
        Name = name;
        Theme = theme;
        UpdatedAt = now;
    }
}
