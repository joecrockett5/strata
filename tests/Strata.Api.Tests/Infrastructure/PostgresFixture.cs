using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(Strata.Api.Tests.Infrastructure.PostgresFixture))]

namespace Strata.Api.Tests.Infrastructure;

/// <summary>One disposable Postgres container shared by every integration test in the assembly.</summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public string ConnectionString => container.GetConnectionString();

    public async ValueTask InitializeAsync() => await container.StartAsync();

    public async ValueTask DisposeAsync() => await container.DisposeAsync();
}
