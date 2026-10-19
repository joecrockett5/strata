using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Strata.Infrastructure.Persistence;

/// <summary>Used only by <c>dotnet ef</c>; the connection string is never opened for migration scaffolding.</summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<StrataDbContext>
{
    public StrataDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<StrataDbContext>()
            .UseNpgsql("Host=localhost;Database=strata_design", npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history"))
            .UseSnakeCaseNamingConvention()
            .Options);
}
