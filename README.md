# Muscle Up Scorecard — go live

## 1. Deploy
Drag this whole folder onto the Vercel "New Project" screen (or use the "folder" link).
Name the project: muscleup-scorecard

## 2. Add the API key
In Vercel: Project > Settings > Environment Variables. Add:
  RESEND_API_KEY = (paste the Resend key you created)
Leave everything else as is.

## 3. Redeploy
Vercel > Deployments > click the latest > Redeploy.
Emails now switch on.

## What it does
- Static scorecard served from /public
- /api/submit stores each lead in Supabase, adds a Resend contact
  (tagged source=muscleup-diagnostic and their main block), and sends
  the matching result email from ring@callumhardingham.com

## Optional env vars (defaults are fine)
  FROM_EMAIL     default "Callum on Rings <ring@callumhardingham.com>"
  SCORECARD_URL  default the deployment's own URL
