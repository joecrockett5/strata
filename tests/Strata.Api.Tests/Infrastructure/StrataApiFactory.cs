using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Strata.Api.Tests.Infrastructure;

public sealed class StrataApiFactory(PostgresFixture postgres) : WebApplicationFactory<Program>
{
    public static readonly TestUser Designer = new("designer@test.local", "Designer!Test1", "Designer");
    public static readonly TestUser Owner = new("owner@test.local", "Owner!Test1", "SiteOwner");
    public static readonly TestUser OtherOwner = new("other-owner@test.local", "Other!Test1", "SiteOwner");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Strata", postgres.ConnectionString);
        builder.UseSetting("Database:InitializeOnStartup", "true");
        builder.UseSetting("Seed:Enabled", "true");

        TestUser[] users = [Designer, Owner, OtherOwner];
        for (var i = 0; i < users.Length; i++)
        {
            builder.UseSetting($"Seed:Users:{i}:Email", users[i].Email);
            builder.UseSetting($"Seed:Users:{i}:Password", users[i].Password);
            builder.UseSetting($"Seed:Users:{i}:DisplayName", users[i].Email);
            builder.UseSetting($"Seed:Users:{i}:Role", users[i].Role);
        }
    }

    /// <summary>A client with its own cookie jar that echoes the XSRF token like the SPA does.</summary>
    public StrataClient CreateStrataClient() => new(CreateDefaultClient(new BrowserLikeHandler()));
}

public sealed record TestUser(string Email, string Password, string Role);
