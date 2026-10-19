namespace Strata.Testing;

/// <summary>Locates files shared across languages (schema, fixtures) from the repository root.</summary>
public static class RepoPaths
{
    public static string Root { get; } = FindRoot();

    public static string Fixture(params string[] parts) => Path.Combine([Root, "fixtures", .. parts]);

    public static string ReadFixture(params string[] parts) => File.ReadAllText(Fixture(parts));

    private static string FindRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Strata.slnx")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new InvalidOperationException("Could not find the repository root (Strata.slnx).");
    }
}
