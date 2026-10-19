using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Strata.Domain.Media;
using Strata.Infrastructure.Content;
using Strata.Infrastructure.Identity;
using Strata.Infrastructure.Persistence;
using Strata.Infrastructure.Seeding;
using Strata.Infrastructure.Storage;

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

        services.AddSingleton<IContentSchemaValidator, ContentSchemaValidator>();
        services.AddSingleton<IRichTextSanitizer, RichTextSanitizer>();
        services.AddSingleton<ContentSanitizer>();

        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.AddSingleton<IFileStorage, LocalFileStorage>();

        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.SectionName));
        services.AddScoped<DatabaseInitializer>();

        return services;
    }
}
