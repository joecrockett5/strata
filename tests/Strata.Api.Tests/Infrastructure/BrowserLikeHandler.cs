using System.Net;

namespace Strata.Api.Tests.Infrastructure;

/// <summary>
/// Keeps cookies between requests and copies the readable <c>XSRF-TOKEN</c> cookie into the
/// <c>X-XSRF-TOKEN</c> header on unsafe requests — the same double-submit behaviour as the editor.
/// </summary>
public sealed class BrowserLikeHandler : DelegatingHandler
{
    private readonly CookieContainer cookies = new();

    public bool SendAntiforgeryHeader { get; set; } = true;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var uri = request.RequestUri!;
        var cookieHeader = cookies.GetCookieHeader(uri);
        if (cookieHeader.Length > 0)
        {
            request.Headers.Add("Cookie", cookieHeader);
        }

        if (SendAntiforgeryHeader && request.Method != HttpMethod.Get && request.Method != HttpMethod.Head)
        {
            var token = cookies.GetCookies(uri)["XSRF-TOKEN"]?.Value;
            if (token is not null)
            {
                request.Headers.Add("X-XSRF-TOKEN", token);
            }
        }

        var response = await base.SendAsync(request, cancellationToken);
        if (response.Headers.TryGetValues("Set-Cookie", out var setCookies))
        {
            foreach (var setCookie in setCookies)
            {
                cookies.SetCookies(uri, setCookie);
            }
        }

        return response;
    }
}
