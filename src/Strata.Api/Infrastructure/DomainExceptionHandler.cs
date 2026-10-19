using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Strata.Domain.Common;

namespace Strata.Api.Infrastructure;

/// <summary>Maps domain and concurrency exceptions to ProblemDetails responses.</summary>
public sealed class DomainExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            DraftConflictException conflict => (StatusCodes.Status409Conflict, "The draft was changed elsewhere", $"Reload to get revision {conflict.Actual}."),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "The draft was changed elsewhere", "Reload and try again."),
            DomainRuleException rule => (StatusCodes.Status422UnprocessableEntity, "The request breaks a rule", rule.Message),
            _ => (0, null, null),
        };

        if (status == 0)
        {
            return false;
        }

        httpContext.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails =
            {
                Status = status,
                Title = title,
                Detail = detail,
                Type = status == StatusCodes.Status409Conflict ? Problems.ConflictType : Problems.ContentInvalidType,
            },
        });
    }
}
