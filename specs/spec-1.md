# Goal

Make this Home Assistant app ask for a token instead of performing a login.
Reason: POP3 access is unstable, Playwright is a huge additional payload.

# Requirements
- Login part should be removed
- The app configuration UI must contain instructions for the user on how to obtain a token (as described by the Playwright script).
- The app configuration should have an input field for the token in its configuration UI in Home Assistant.
- Quick validation of the input token should be possible right after saving the config.
- The token should be renewed before expiry.
- If renewal fails, the app should set one a (new) status entity's error attribute to true, another attribute to the error's text.