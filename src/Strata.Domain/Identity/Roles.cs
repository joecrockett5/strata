namespace Strata.Domain.Identity;

/// <summary>The two application roles. Names are persisted in Identity tables; do not rename.</summary>
public static class Roles
{
    public const string Designer = "Designer";
    public const string SiteOwner = "SiteOwner";

    public static IReadOnlyList<string> All { get; } = [Designer, SiteOwner];
}
