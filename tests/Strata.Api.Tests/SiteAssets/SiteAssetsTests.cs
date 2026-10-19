using System.Net;
using Strata.Api.Tests.Infrastructure;

namespace Strata.Api.Tests.SiteAssets;

public sealed class SiteAssetsTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    [Theory]
    [InlineData("/site-assets/site.css", "text/css", ".st-site")]
    [InlineData("/site-assets/site.js", "text/javascript", "st-nav__toggle")]
    public async Task Shared_site_assets_are_served_publicly(string path, string contentType, string marker)
    {
        using var client = AnonymousClient();

        using var response = await client.Http.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        await response.ShouldHaveStatusAsync(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe(contentType);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain(marker);
    }
}
