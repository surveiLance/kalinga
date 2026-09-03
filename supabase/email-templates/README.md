# Kalinga confirmation email setup

The app now sends `emailRedirectTo` as `https://your-domain/?confirmed=1`. After Supabase verifies the email, its browser client restores the session and Kalinga opens the teacher’s Today screen automatically.

In the Supabase dashboard:

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://kalinga-gules.vercel.app`.
3. Add these **Redirect URLs**:
   - `https://kalinga-gules.vercel.app/**`
   - `http://localhost:3000/**`
4. Open **Authentication → Email Templates → Confirm signup**.
5. Use the subject `Welcome to Kalinga — confirm your teacher account`.
6. Paste the contents of `confirm-signup.html` into the message body and save.

The template deliberately uses `{{ .ConfirmationURL }}` so Supabase keeps control of verification while preserving the redirect requested by the app.
