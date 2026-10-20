using System.Text.RegularExpressions;
using Strata.Rendering;

namespace Strata.Api.Features.PublicSites;

/// <summary>Server-side validation of a contact form post (the browser's checks are a convenience only).</summary>
public static partial class ContactForm
{
    /// <summary>Hidden field real visitors never fill in; bots usually do.</summary>
    public const string HoneypotField = "website";

    public sealed record Submission(string Name, string Email, string? Phone, string Message);

    public static (Submission? Valid, Dictionary<string, string> Values, Dictionary<string, string> Errors) Validate(IFormCollection form)
    {
        var values = ContactFields.All.ToDictionary(f => f.Name, f => form[f.Name].ToString().Trim(), StringComparer.Ordinal);
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var field in ContactFields.All)
        {
            var value = values[field.Name];
            if (field.Required && value.Length == 0)
            {
                errors[field.Name] = field.Name switch
                {
                    "name" => "Enter your name.",
                    "email" => "Enter your email address.",
                    _ => "Enter a message.",
                };
            }
            else if (value.Length > field.MaxLength)
            {
                errors[field.Name] = $"Use at most {field.MaxLength} characters.";
            }
        }

        if (!errors.ContainsKey("email") && !EmailPattern().IsMatch(values["email"]))
        {
            errors["email"] = "Enter an email address like name@example.com.";
        }

        if (!errors.ContainsKey("phone") && values["phone"].Length > 0 && !PhonePattern().IsMatch(values["phone"]))
        {
            errors["phone"] = "Enter a phone number using digits, spaces and + ( ) -.";
        }

        var valid = errors.Count == 0
            ? new Submission(values["name"], values["email"], values["phone"].Length == 0 ? null : values["phone"], values["message"])
            : null;
        return (valid, values, errors);
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"^[0-9+()\-.\s]{5,40}$")]
    private static partial Regex PhonePattern();
}
