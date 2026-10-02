# Supabase Config Audit: my-fitness

- **Project:** `uhbgogzfelkbnrqthutg` (ScalexForge org)
- **Region / compute:** South Asia (Mumbai) ap-south-1, Nano
- **Audited:** 2 Oct 2026, ~13:50 IST, via the Supabase dashboard
- **Status:** Healthy (CPU 2%, Disk 13%, RAM 54%, 7/60 connections)

## Summary

| Area | Status | Notes |
|---|---|---|
| Custom SMTP (Gmail) | ❌ **Broken** | Gmail rejects the saved password (`535 BadCredentials`) |
| Data API table exposure | ⚠️ **Check** | 0 of 6 tables exposed. Client-side queries will fail |
| `handle_new_user()` function | ⚠️ Warning | SECURITY DEFINER function callable by anon + authenticated |
| Site URL / Redirect URLs | ⚠️ Dev only | `http://localhost:3000`, no redirect URLs |
| Row Level Security | ✅ OK | RLS on for all 6 tables, own-row policies |
| Storage (`meal-photos`) | ✅ OK | 1 policy (owner only); no size or MIME limit |
| Auth providers | ✅ OK | Email only; signups on, confirm email on, anonymous off |
| Rate limits | ✅ OK | Email sent 30/h, OTP 30, verify 30, token refresh 150 |
| Performance advisor | ✅ OK | 0 errors, 0 warnings, 4 info |
| GitHub / backups | ℹ️ | No repo connected, no backups listed |

## 1. SMTP: why "Send code" fails ❌

**Auth log, 02 Oct 13:46:30, `POST /otp` → 500:**

```
535 5.7.8 Username and Password not accepted (BadCredentials) - gsmtp
```

The /otp call at 13:46:15 failed the same way.

Saved fields (I checked the exact values; no stray spaces):

| Field | Value | OK? |
|---|---|---|
| Custom SMTP | Enabled | ✅ |
| Sender email | `kadamchinmay8@gmail.com` | ✅ matches username |
| Sender name | `My Fitness` | ✅ |
| Host | `smtp.gmail.com` | ✅ |
| Port | `465` | ✅ |
| Min interval per user | 60 s | ✅ |
| Username | `kadamchinmay8@gmail.com` | ✅ |
| Password | (hidden after save) | ❌ **Rejected by Gmail** |

**Fix:**

1. Sign in to Google as **kadamchinmay8@gmail.com**. Make sure 2-Step Verification is on, because app passwords require it.
2. Open https://myaccount.google.com/apppasswords and create a new app password.
3. In Supabase, go to **Authentication → Emails → SMTP Settings**. Paste the 16 letters **without spaces** into Password, then click **Save changes**.
4. Wait about 60 seconds, then tap **Send code** again.

**Update 13:57 IST:** a new app password was saved, and the Auth logs show the config reloading at 13:57:17 and 13:57:42. No `/otp` attempt has been logged since, so the fix is **not verified yet**.

Note: Supabase warns that Gmail is meant for personal email, so delivery can be unreliable and limits are low. For production, use a transactional provider such as Resend, Postmark, SES or Brevo.

## 2. Data API exposure ⚠️

- Exposed schemas: `public`, `extensions`
- **Exposed tables: 0 of 6.** Every table shows "API DISABLED"
- Exposed functions: 1 of 1 (`handle_new_user`)
- "Automatically expose new tables" is off

If the app reads or writes `profiles`, `meals`, `workouts`, `workout_plans`, `daily_summaries` or `coach_messages` with `supabase-js` from the browser, those requests will fail with *permission denied*. **Fix:** go to **Integrations → Data API → Settings → Exposed tables** and turn on the tables the client uses. RLS still protects the rows.

## 3. Security advisor: 2 warnings ⚠️

Both warnings are about `public.handle_new_user()`, a SECURITY DEFINER function that anon and signed-in users can execute through the API. It's a signup trigger function and shouldn't be callable by clients. Fix it in the SQL editor:

```sql
revoke execute on function public.handle_new_user() from anon, authenticated, public;
```

The trigger on `auth.users` will keep working after this change. Then click **Rerun linter**.

## 4. Auth settings

- **Providers:** Email enabled. All social, phone and SAML providers disabled.
- **Allow new signups:** on. **Confirm email:** on. **Anonymous sign-ins:** off. **Manual linking:** off.
- **Site URL:** `http://localhost:3000`. **Redirect URLs:** none.
  - Before going live, set the Site URL to your production domain and add redirect URLs (for example `http://localhost:3000/**` and `https://<prod-domain>/**`). Otherwise confirmation and reset links will point to localhost.
- **Logs:** repeated deprecation warnings about `GOTRUE_JWT_ADMIN_GROUP_NAME` and `GOTRUE_JWT_DEFAULT_GROUP_NAME`. These come from Supabase's platform and need no action.

## 5. Database and RLS ✅

RLS is enabled on all tables in `public`:

| Table | Policy | Command | Role |
|---|---|---|---|
| coach_messages | Own rows | ALL | authenticated |
| daily_summaries | Own rows | ALL | authenticated |
| meals | Own rows | ALL | authenticated |
| profiles | Own profile | ALL | authenticated |
| workout_plans | Own rows | ALL | authenticated |
| workouts | Own rows | ALL | authenticated |

Last migration: `initial_schema`. Optional: turn on the "auto-enable RLS on new tables" trigger.

## 6. Storage

- Bucket `meal-photos` has 1 policy, "Own meal photos" (ALL, authenticated).
- File size limit: unset (50 MB default). Allowed MIME types: any.
  - Suggested: set a 5–10 MB limit and allow only `image/jpeg, image/png, image/webp`.

## To-do (priority order)

- [ ] Create a new Gmail app password, paste it into SMTP settings and save (fixes Send code)
- [ ] Expose the 6 tables in Data API settings, if the client queries them directly
- [ ] Revoke EXECUTE on `handle_new_user()` from anon and authenticated
- [ ] Set a size limit and MIME types on the `meal-photos` bucket
- [ ] Before launch: production Site URL and redirect URLs, a transactional SMTP provider, and backups
