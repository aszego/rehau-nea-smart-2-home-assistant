using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Rehau.TokenHelper;

internal sealed record TokenPair(string AccessToken, string RefreshToken);

internal sealed record OAuthSession(string Verifier, string State, Uri AuthorizationUrl)
{
    internal const string ClientId = "3f5d915d-a06f-42b9-89cc-2e5d63aa96f1";
    internal const string RedirectUri = "https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg";
    internal const string TokenUrl = "https://accounts.rehau.com/token-srv/token";

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    internal static OAuthSession Create()
    {
        var verifier = Base64Url(RandomNumberGenerator.GetBytes(32));
        var state = Base64Url(RandomNumberGenerator.GetBytes(32));
        var parameters = new Dictionary<string, string>
        {
            ["client_id"] = ClientId,
            ["scope"] = "email roles profile offline_access groups",
            ["response_type"] = "code",
            ["redirect_uri"] = RedirectUri,
            ["nonce"] = Base64Url(RandomNumberGenerator.GetBytes(16)),
            ["state"] = state,
            ["code_challenge_method"] = "S256",
            ["code_challenge"] = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)))
        };
        var query = string.Join("&", parameters.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
        return new OAuthSession(verifier, state, new Uri($"https://accounts.rehau.com/authz-srv/authz?{query}"));
    }

    internal string ExtractCode(string input)
    {
        if (!Uri.TryCreate(input.Trim(), UriKind.Absolute, out var url))
            throw new ArgumentException("Paste the complete final redirect URL, not just the authorization code.");
        var expected = new Uri(RedirectUri);
        if (url.Scheme != expected.Scheme || url.Host != expected.Host || url.Port != expected.Port ||
            url.AbsolutePath != expected.AbsolutePath || url.UserInfo.Length != 0 || url.Fragment.Length != 0)
            throw new ArgumentException("The URL is not the expected REHAU image redirect.");
        var parameters = ParseQuery(url);
        if (!parameters.TryGetValue("state", out var states) || states.Count != 1 ||
            !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(states[0]), Encoding.UTF8.GetBytes(State)))
            throw new ArgumentException("OAuth state does not match this helper session. Use the login URL printed by this running helper.");
        if (parameters.ContainsKey("error"))
            throw new InvalidOperationException("REHAU authorization was denied. Start again and complete login.");
        if (!parameters.TryGetValue("code", out var codes) || codes.Count != 1 || string.IsNullOrWhiteSpace(codes[0]))
            throw new ArgumentException("The redirect must contain exactly one authorization code.");
        return codes[0];
    }

    internal static Dictionary<string, List<string>> ParseQuery(Uri url)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var item in url.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = item.Split('=', 2);
            var key = Uri.UnescapeDataString(parts[0].Replace('+', ' '));
            var value = parts.Length == 2 ? Uri.UnescapeDataString(parts[1].Replace('+', ' ')) : "";
            if (!result.TryGetValue(key, out var values)) result[key] = values = [];
            values.Add(value);
        }
        return result;
    }

    internal async Task<TokenPair> ExchangeAsync(HttpClient http, string code, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, TokenUrl)
        {
            Content = JsonContent.Create(new
            {
                grant_type = "authorization_code", client_id = ClientId,
                redirect_uri = RedirectUri, code_verifier = Verifier, code
            })
        };
        request.Headers.Accept.ParseAdd("application/json");
        using var response = await http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Token exchange rejected (HTTP {(int)response.StatusCode}). The code may be expired/used, or REHAU may require browser-session protection. Start a fresh login; do not share the response body.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("access_token", out var access) || access.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(access.GetString()) ||
            !root.TryGetProperty("refresh_token", out var refresh) || refresh.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(refresh.GetString()))
            throw new InvalidOperationException("REHAU did not return both access_token and refresh_token. No usable token pair was obtained.");
        return new TokenPair(access.GetString()!, refresh.GetString()!);
    }
}
