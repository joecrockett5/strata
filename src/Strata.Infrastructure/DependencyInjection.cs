using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Strata.Infrastructure.Identity;
using Strata.Infrastructure.Persistence;
using Strata.Infrastructure.Seeding;

namespace Strata.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddStrataInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Strata")
            ?? throw new InvalidOperationException("Connection string 'Strata' is not configured.");

        services.AddDbContext<StrataDbContext>(options => options
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history"))
            .UseSnakeCaseNamingConvention());

        services
            .AddIdentityCore<StrataUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 10;
                options.Lockout.MaxFailedAccessAttempts = 10;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<StrataDbContext>()
            .AddSignInManager();

        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.SectionName));
        services.AddScoped<DatabaseInitializer>();

        return services;
    }
}
