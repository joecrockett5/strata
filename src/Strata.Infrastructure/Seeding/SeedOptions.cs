namespace Strata.Infrastructure.Seeding;

/// <summary>Development seed configuration (bound from the <c>Seed</c> section).</summary>
public sealed class SeedOptions
{
    public const string SectionName = "Seed";

    public bool Enabled { get; set; }

    /// <summary>Seed the Harbor &amp; Pine section types, template and published demo site.</summary>
    public bool DemoContent { get; set; } = true;

    public List<SeedUser> Users { get; set; } = [];
}

public sealed class SeedUser
{
    public required string Email { get; set; }
    public required string Password { get; set; }
    public required string DisplayName { get; set; }
    public required string Role { get; set; }
}
