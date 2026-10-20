using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Strata.Api.Tests.Infrastructure;

namespace Strata.Api.Tests.Publishing;

public sealed class ContactFormTests : ApiTestBase
{
    private const int PermitLimit = 3;

    public ContactFormTests(PostgresFixture postgres)
        : base(postgres)
    {
        Factory.Settings["PublicSites:ContactPermitLimit"] = PermitLimit.ToString(System.Globalization.CultureInfo.InvariantCulture);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<PublishableSite> PublishedSiteAsync()
    {
        var owner = await OwnerAsync();
        var site = await Publishing.CreateAsync(await DesignerAsync(), owner, photo: await owner.UploadPngAsync(), alt: "Office");
        using var publish = await owner.Http.PostAsync(new Uri($"/api/sites/{site.Site.Id}/publish", UriKind.Relative), null, Ct);
        await publish.ShouldHaveStatusAsync(HttpStatusCode.Created);
        return site;
    }

    private static FormUrlEncodedContent Form(PublishableSite site, string name = "Ada Lovelace", string email = "ada@example.com", string message = "Please call me.", string website = "") =>
        new(new Dictionary<string, string>
        {
            ["sectionId"] = site.ContactId.ToString(),
            ["pageId"] = site.AboutId.ToString(),
            ["name"] = name,
            ["email"] = email,
            ["phone"] = "",
            ["message"] = message,
            ["website"] = website,
        });

    private static Task<HttpResponseMessage> PostAsync(StrataClient client, PublishableSite site, FormUrlEncodedContent form) =>
        client.Http.PostAsync(new Uri($"/s/{site.Site.Slug}/_contact", UriKind.Relative), form, Ct);

    private static async Task<JsonElement[]> SubmissionsAsync(PublishableSite site) =>
        (await site.Owner.Http.GetFromJsonAsync<JsonElement[]>($"/api/sites/{site.Site.Id}/submissions", Ct))!;

    [Fact]
    public async Task Valid_submissions_are_stored_and_redirect_to_a_success_message()
    {
        var site = await PublishedSiteAsync();
        using var anonymous = AnonymousClient();

        using var response = await PostAsync(anonymous, site, Form(site));

        response.StatusCode.ShouldBe(HttpStatusCode.SeeOther);
        var location = response.Headers.Location!.ToString();
        location.ShouldBe($"/s/{site.Site.Slug}/about?sent={site.ContactId}#section-{site.ContactId}");
        var page = await anonymous.Http.GetStringAsync(new Uri(location, UriKind.Relative), Ct);
        WebUtility.HtmlDecode(page).ShouldContain("Thanks — we'll reply soon.");

        var stored = (await SubmissionsAsync(site)).ShouldHaveSingleItem();
        stored.GetProperty("name").GetString().ShouldBe("Ada Lovelace");
        stored.GetProperty("email").GetString().ShouldBe("ada@example.com");
        stored.GetProperty("pageId").GetGuid().ShouldBe(site.AboutId);
    }

    [Fact]
    public async Task Invalid_submissions_re_render_the_form_with_errors_and_values()
    {
        var site = await PublishedSiteAsync();
        using var anonymous = AnonymousClient();

        using var response = await PostAsync(anonymous, site, Form(site, name: "Ada", email: "not-an-email", message: ""));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var html = await response.Content.ReadAsStringAsync(Ct);
        html.ShouldContain("Enter an email address like name@example.com.");
        html.ShouldContain("Enter a message.");
        html.ShouldContain("value=\"Ada\"");
        html.ShouldContain("aria-invalid=\"true\"");
        (await SubmissionsAsync(site)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Honeypot_submissions_look_successful_but_are_dropped()
    {
        var site = await PublishedSiteAsync();
        using var anonymous = AnonymousClient();

        using var response = await PostAsync(anonymous, site, Form(site, website: "https://spam.example"));

        response.StatusCode.ShouldBe(HttpStatusCode.SeeOther);
        (await SubmissionsAsync(site)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Posts_must_target_a_published_contact_form_on_that_page()
    {
        var site = await PublishedSiteAsync();
        using var anonymous = AnonymousClient();
        var wrongSection = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["sectionId"] = site.HeroId.ToString(),
            ["pageId"] = site.Site.Document.Pages[0].Id.ToString(),
            ["name"] = "A",
            ["email"] = "a@example.com",
            ["message"] = "Hi",
        });

        using var response = await PostAsync(anonymous, site, wrongSection);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await SubmissionsAsync(site)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Submissions_are_rate_limited()
    {
        var site = await PublishedSiteAsync();
        using var anonymous = AnonymousClient();

        for (var i = 0; i < PermitLimit; i++)
        {
            using var accepted = await PostAsync(anonymous, site, Form(site));
            accepted.StatusCode.ShouldBe(HttpStatusCode.SeeOther);
        }

        using var limited = await PostAsync(anonymous, site, Form(site));

        limited.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        (await SubmissionsAsync(site)).Length.ShouldBe(PermitLimit);
    }
}
