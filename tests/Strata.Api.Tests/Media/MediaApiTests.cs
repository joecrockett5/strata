using System.Net;
using System.Text;
using Strata.Api.Tests.Infrastructure;
using Strata.Domain.Content.Validation;
using static Strata.Testing.Content;

namespace Strata.Api.Tests.Media;

public sealed class MediaApiTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    [Fact]
    public async Task Png_upload_is_stored_and_served_with_the_sniffed_type()
    {
        var owner = await OwnerAsync();

        using var upload = await owner.UploadAsync(TestImages.Png(30, 20), "holiday.jpg", "image/jpeg");

        await upload.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var media = await upload.ReadJsonAsync();
        media.GetProperty("contentType").GetString().ShouldBe("image/png");
        media.GetProperty("width").GetInt32().ShouldBe(30);
        media.GetProperty("height").GetInt32().ShouldBe(20);

        using var anonymous = AnonymousClient();
        using var file = await anonymous.Http.GetAsync(new Uri(media.GetProperty("url").GetString()!, UriKind.Relative), TestContext.Current.CancellationToken);
        await file.ShouldHaveStatusAsync(HttpStatusCode.OK);
        file.Content.Headers.ContentType!.MediaType.ShouldBe("image/png");
        file.Headers.GetValues("X-Content-Type-Options").ShouldBe(["nosniff"]);
        (await file.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldBe(TestImages.Png(30, 20));
    }

    [Theory]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>", "logo.svg", "image/svg+xml")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "logo.png", "image/png")]
    [InlineData("MZ this is an executable", "photo.jpg", "image/jpeg")]
    public async Task Non_raster_files_are_rejected_whatever_their_name(string content, string fileName, string contentType)
    {
        var owner = await OwnerAsync();

        using var response = await owner.UploadAsync(Encoding.UTF8.GetBytes(content), fileName, contentType);

        response.StatusCode.ShouldBe(HttpStatusCode.UnsupportedMediaType);
    }

    [Fact]
    public async Task Files_over_5_mb_are_rejected()
    {
        var owner = await OwnerAsync();
        var big = new byte[(5 * 1024 * 1024) + 1];
        TestImages.Png().CopyTo(big, 0);

        using var response = await owner.UploadAsync(big, "big.png", "image/png");

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
    }

    [Fact]
    public async Task Owners_cannot_reference_another_owners_media()
    {
        var designer = await DesignerAsync();
        var photo = await designer.PublishedSectionAsync("Photo", Section(ImageNode("i", ImageSlot("photo"))));
        var other = await OwnerAsync(StrataApiFactory.OtherOwner);
        var othersMedia = await other.UploadPngAsync();
        var owner = await OwnerAsync();
        var site = await owner.CreateSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.MapPage(0, p => p with { Sections = [Instance(photo, values: Values(("photo", Image(othersMedia, "Not mine"))))] }));

        await response.ShouldBeRejectedWithAsync(ViolationCodes.MediaNotFound);
    }

    [Fact]
    public async Task Owners_can_use_their_own_and_designer_provided_media()
    {
        var designer = await DesignerAsync();
        var photo = await designer.PublishedSectionAsync("Gallery", Section(ImageNode("a", ImageSlot("first")), ImageNode("b", ImageSlot("second"))));
        var designerMedia = await new OwnerApi(await ClientForAsync(StrataApiFactory.Designer)).UploadPngAsync();
        var owner = await OwnerAsync();
        var ownMedia = await owner.UploadPngAsync();
        var site = await owner.CreateSiteAsync();

        using var response = await owner.SaveAsync(site, d => d.MapPage(0, p => p with
        {
            Sections = [Instance(photo, values: Values(("first", Image(ownMedia, "Mine")), ("second", Image(designerMedia, "From the template"))))],
        }));

        await response.ShouldHaveStatusAsync(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Media_listing_only_shows_the_callers_uploads()
    {
        var owner = await OwnerAsync();
        var mine = await owner.UploadPngAsync();
        var other = await OwnerAsync(StrataApiFactory.OtherOwner);

        var listing = await other.Http.GetStringAsync(new Uri("/api/media", UriKind.Relative), TestContext.Current.CancellationToken);

        listing.ShouldNotContain(mine.ToString());
    }
}
