using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Strata.Domain.SectionTypes;
using Strata.Infrastructure.Identity;

namespace Strata.Infrastructure.Persistence.Configurations;

internal sealed class SectionTypeConfiguration : IEntityTypeConfiguration<SectionType>
{
    public void Configure(EntityTypeBuilder<SectionType> builder)
    {
        builder.ToTable("section_types");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(120);
        builder.Property(x => x.Category).HasMaxLength(60);
        builder.Property(x => x.Draft).HasContentJson();
        builder.Property(x => x.DraftRevision).IsConcurrencyToken();
        builder.HasOne<StrataUser>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Versions).WithOne().HasForeignKey(v => v.SectionTypeId).OnDelete(DeleteBehavior.Restrict);
        builder.Navigation(x => x.Versions).HasField("versions").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(x => x.IsArchived);
        builder.Ignore(x => x.HasUnpublishedChanges);
        builder.HasIndex(x => x.Category);
    }
}

internal sealed class SectionTypeVersionConfiguration : IEntityTypeConfiguration<SectionTypeVersion>
{
    public void Configure(EntityTypeBuilder<SectionTypeVersion> builder)
    {
        builder.ToTable("section_type_versions");
        builder.HasKey(x => new { x.SectionTypeId, x.Version });
        builder.Property(x => x.Name).HasMaxLength(120);
        builder.Property(x => x.Category).HasMaxLength(60);
        builder.Property(x => x.Definition).HasContentJson();
        builder.HasOne<StrataUser>().WithMany().HasForeignKey(x => x.PublishedBy).OnDelete(DeleteBehavior.Restrict);
        builder.Ignore(x => x.Ref);
    }
}
