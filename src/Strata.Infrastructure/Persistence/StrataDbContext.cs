using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Strata.Infrastructure.Identity;

namespace Strata.Infrastructure.Persistence;

public sealed class StrataDbContext(DbContextOptions<StrataDbContext> options)
    : IdentityDbContext<StrataUser, IdentityRole<Guid>, Guid>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(StrataDbContext).Assembly);
    }
}
