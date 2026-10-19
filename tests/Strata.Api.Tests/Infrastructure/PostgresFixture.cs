using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(Strata.Api.Tests.Infrastructure.PostgresFixture))]

namespace Strata.Api.Tests.Infrastructure;

/// <summary>
/// One disposable Postgres container shared by every integration test in the assembly. The schema
/// is migrated and seeded once here; per-class API hosts then skip initialisation so parallel test
/// classes never race on migrations or seed data.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public string ConnectionString => container.GetConnectionString();

    public async ValueTask InitializeAsync()
    {
        await container.StartAsync();
        await using var initializer = new StrataApiFactory(this, initializeDatabase: true);
        using var client = initializer.CreateClient();
        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative));
        response.EnsureSuccessStatusCode();
    }

    public async ValueTask DisposeAsync() => await container.DisposeAsync();
}
