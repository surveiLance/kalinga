# Kalinga confirmation email setup

The app now sends `emailRedirectTo` as `https://your-domain/?confirmed=1`. After Supabase verifies the email, its browser client restores the session and Kalinga opens the teacher’s Today screen automatically.

In the Supabase dashboard:

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://kalinga-gules.vercel.app`.
3. Add these **Redirect URLs**:
   - `https://kalinga-gules.vercel.app/**`
   - `http://localhost:3000/**`
4. Remove any bare `kalinga-gules.vercel.app` URL that does not begin with
   `https://`.

The URL configuration above fixes the `requested path is invalid` confirmation
error. Only newly generated confirmation emails will use the corrected URL.

## Branded email requirement

This project's hosted Supabase free tier currently uses Supabase's default email
sender. Supabase does not allow that setup to use custom templates, so the
standard “Confirm your email address” message remains until a custom SMTP sender
is configured (or the Supabase project is upgraded).

After custom SMTP is connected:

1. Open **Authentication → Email Templates → Confirm signup**.
2. Use the subject `Welcome to Kalinga — confirm your teacher account`.
3. Paste the contents of `confirm-signup.html` into the message body and save.

The template deliberately uses `{{ .ConfirmationURL }}` so Supabase keeps control of verification while preserving the redirect requested by the app.
