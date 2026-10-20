using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Strata.Api.Tests.Infrastructure;

public sealed class StrataApiFactory(PostgresFixture postgres, bool initializeDatabase = false) : WebApplicationFactory<Program>
{
    public static readonly TestUser Designer = new("designer@test.local", "Designer!Test1", "Designer");
    public static readonly TestUser Owner = new("owner@test.local", "Owner!Test1", "SiteOwner");
    public static readonly TestUser OtherOwner = new("other-owner@test.local", "Other!Test1", "SiteOwner");

    /// <summary>
    /// Used only for failed-login tests. A failed attempt makes Identity reset the failure counter
    /// (a concurrency-stamped update) on the next successful login, which can lose a race against
    /// parallel logins of the same account — so other tests never share this user.
    /// </summary>
    public static readonly TestUser LoginProbe = new("login-probe@test.local", "Probe!Test1", "SiteOwner");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Strata", postgres.ConnectionString);
        builder.UseSetting("Database:InitializeOnStartup", initializeDatabase ? "true" : "false");
        builder.UseSetting("Storage:RootPath", MediaRoot);
        builder.UseSetting("Seed:Enabled", "true");
        foreach (var (key, value) in Settings)
        {
            builder.UseSetting(key, value);
        }

        TestUser[] users = [Designer, Owner, OtherOwner, LoginProbe];
        for (var i = 0; i < users.Length; i++)
        {
            builder.UseSetting($"Seed:Users:{i}:Email", users[i].Email);
            builder.UseSetting($"Seed:Users:{i}:Password", users[i].Password);
            builder.UseSetting($"Seed:Users:{i}:DisplayName", users[i].Email);
            builder.UseSetting($"Seed:Users:{i}:Role", users[i].Role);
        }
    }

    /// <summary>Extra configuration for this host; set before the first client is created.</summary>
    public Dictionary<string, string> Settings { get; } = [];

    /// <summary>Uploaded files for this host go to a throwaway directory.</summary>
    public string MediaRoot { get; } = Path.Combine(Path.GetTempPath(), "strata-tests", Guid.NewGuid().ToString("N"));

    /// <summary>A client with its own cookie jar that echoes the XSRF token like the SPA does.</summary>
    public StrataClient CreateStrataClient() => new(CreateDefaultClient(new BrowserLikeHandler()));
}

public sealed record TestUser(string Email, string Password, string Role);
