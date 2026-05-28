# School Outreach CRM

A local full-stack CRM for managing school outreach databases, Excel uploads, calling dispositions, reminders, event registrations, campaigns, assignments, and reports.

## Run

```bash
/Users/akshayseal/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 app.py
```

Open:

```text
http://127.0.0.1:8766
```

## Demo Logins

```text
Admin: admin@schoolcrm.local / admin123
Outreach: outreach1@schoolcrm.local / outreach123
Outreach: outreach2@schoolcrm.local / outreach123
```

## Notes

- The app imports columns A to AD from the provided workbook.
- Missing school codes are generated as state code + district code + four-digit sequence, for example `MH010001`.
- Admins can upload Excel files, create campaigns, assign calling lists, and view reports.
- Outreach users see assigned schools, update call dispositions, add notes, and create reminders.
- Cell edits are saved in `edit_history` and visible from the school drawer.
- Admin signup requires an admin secret. Locally it defaults to `XM-ADMIN-2026`; on deployment, set `ADMIN_SECRET`.
- Field filters are available for every imported column, so the visible dataset can be turned into a campaign or calling assignment.

## Deploy

This repo includes `requirements.txt` and `render.yaml`.

Recommended quick deployment:

1. Push this folder to GitHub.
2. Create a Render Blueprint from the repository.
3. Render will use `render.yaml`, install dependencies, mount a persistent cloud disk, and run the app.
4. Keep the generated `ADMIN_SECRET` safe. Users need it only when creating an admin account.

Deployment environment variables:

```text
HOST=0.0.0.0
DB_PATH=/var/data/schoolcrm.sqlite3
ADMIN_SECRET=<your-secret-code>
```
