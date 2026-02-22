# Attendance Management System

A full-stack attendance management system with PWA support, QR code scanning, and role-based access control.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 4, MySQL 8 |
| Admin Frontend | React 18, Vite, React Router v6 |
| User Frontend | React 18, Vite, PWA (Workbox) |
| Auth | JWT (7d), bcryptjs |
| QR | HMAC-SHA256 daily-rotating tokens |

## Project Structure

```
scan/
├── backend/          # Express REST API  (port 5000)
├── admin-frontend/   # Admin panel       (port 5173)
└── user-frontend/    # Employee PWA      (port 5174)
```

## Quick Start

### Prerequisites
- Node.js v18+
- MySQL 8 running locally
- Git

### 1. Configure the backend

Edit `backend/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=attendance_system
JWT_SECRET=change_this_super_secret_key_2026
JWT_EXPIRES_IN=7d
ADMIN_FRONTEND_URL=http://localhost:5173
USER_FRONTEND_URL=http://localhost:5174
```

### 2. Install dependencies

```bash
cd backend         && npm install
cd ../admin-frontend && npm install
cd ../user-frontend  && npm install
```

### 3. Start all servers

Open three terminals:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Admin panel
cd admin-frontend && npm run dev

# Terminal 3 — Employee PWA
cd user-frontend && npm run dev
```

The backend auto-creates the `attendance_system` database and all tables on first run.
A default admin account is seeded automatically:

| Field | Value |
|---|---|
| Email | admin@admin.com |
| Password | admin123 |

## Features

### Admin Panel (`http://localhost:5173`)
- **Dashboard** — today's stats (total employees, present, late, absent)
- **Branches** — CRUD + QR code generation per branch
- **Employees** — CRUD with branch assignment and role management
- **Attendance Report** — filterable table with CSV export
- **Settings** — work hours, break duration, grace period

### Employee PWA (`http://localhost:5174`)
- **Installable** on Android/iOS via "Add to Home Screen"
- **Home** — real-time clock, today's 4-step scan status
- **Scanner** — camera QR scan → auto check-in/break-out/break-in/check-out
- **History** — monthly attendance records with summary stats

## QR Token System

Each branch has a unique `qr_secret`. The daily QR payload is:

```json
{ "branch_id": 1, "token": "HMAC-SHA256(branchId|YYYY-MM-DD, qr_secret)" }
```

Tokens rotate at midnight. Display the QR on a screen or print it daily.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login |
| GET | `/api/branches` | Admin | List branches |
| POST | `/api/branches` | Admin | Create branch |
| GET | `/api/branches/:id/qr` | Admin | Get today's QR |
| GET | `/api/users` | Admin | List users |
| POST | `/api/users` | Admin | Create user |
| POST | `/api/attendance/scan` | Employee | Record scan |
| GET | `/api/attendance/my` | Employee | Own records |
| GET | `/api/attendance/dashboard` | Admin | Today stats |
| GET | `/api/attendance/report` | Admin | Filtered report |
| GET/PUT | `/api/attendance/settings` | Admin | Work hours config |

## Icons (PWA)

Place two PNG icons in `user-frontend/public/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

You can generate them at [https://realfavicongenerator.net](https://realfavicongenerator.net).

## Deploy to cPanel (Production Hosting)

This project is easiest to deploy on cPanel using:

- **Backend**: cPanel “Setup Node.js App” (Passenger) on a subdomain like `api.yourdomain.com`
- **Frontends**: Vite static build output uploaded to subdomains like `admin.yourdomain.com` and `app.yourdomain.com`

If your cPanel account **does not** have “Setup Node.js App”, you can still host the two frontends on cPanel, but you’ll need to run the backend somewhere else (VPS / Render / Railway / etc.).

### 1) Create a MySQL database in cPanel

In **MySQL® Databases**:

1. Create a database (example: `cpuser_attendance_system`)
2. Create a database user + password
3. Add the user to the database with **ALL PRIVILEGES**

Important: on shared hosting, the DB user usually cannot run `CREATE DATABASE` from code, so production should use `DB_AUTO_CREATE=false`.

### 2) Deploy the backend (Node.js / Express)

1. Upload the `backend/` folder to your hosting account (for example: `/home/CPANEL_USER/attendance-backend`).
2. In cPanel, go to **Setup Node.js App** → **Create Application**.
	- **Node.js version**: 18+ (recommended)
	- **Application mode**: Production
	- **Application root**: the folder you uploaded (example: `attendance-backend`)
	- **Application URL**: `https://api.yourdomain.com` (recommended as a subdomain)
	- **Application startup file**: `server.js`
3. Set environment variables in the Node.js App UI:

```env
# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=cpuser_dbuser
DB_PASSWORD=your_db_password
DB_NAME=cpuser_attendance_system

# Auth
JWT_SECRET=put_a_long_random_string_here
JWT_EXPIRES_IN=7d

# CORS (must match your real frontend origins)
ADMIN_FRONTEND_URL=https://admin.yourdomain.com
USER_FRONTEND_URL=https://app.yourdomain.com

# Recommended on cPanel
DB_AUTO_CREATE=false
```

4. Click **Run NPM Install**, then **Restart** the application.
5. Verify the API is up:
	- `https://api.yourdomain.com/api/health` should return `{ "status": "ok" }`.

### 3) Build & upload the admin frontend (static)

The admin app reads the API URL at **build time**.

1. In `admin-frontend/`, create `.env.production`:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

2. Build locally:

```bash
cd admin-frontend
npm install
npm run build
```

3. Upload the contents of `admin-frontend/dist/` to the document root of your admin site, for example:
	- subdomain `admin.yourdomain.com` → its docroot folder

4. Add an `.htaccess` in that docroot so React Router routes work on refresh:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### 4) Build & upload the employee PWA (static)

1. In `user-frontend/`, create `.env.production`:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

2. Build locally:

```bash
cd user-frontend
npm install
npm run build
```

3. Upload the contents of `user-frontend/dist/` to the document root of your employee site (recommended as its own subdomain like `app.yourdomain.com`).
4. Add the same `.htaccess` rewrite rules (React Router).

Notes for PWA:

- Use **HTTPS**, otherwise installability/service worker can be blocked.
- Hosting the PWA at the site root (domain/subdomain root) matches the current `start_url: '/'` in `vite-plugin-pwa`.

### 5) Common gotchas

- **CORS**: `ADMIN_FRONTEND_URL` and `USER_FRONTEND_URL` must match the exact origin (scheme + host + optional port). Add `https://www...` variants if you use them.
- **Database permissions**: if the backend fails at startup with DB errors, confirm the DB name includes the cPanel prefix and that the DB user has privileges on that DB.
- **Single domain with subfolders** (`/admin`, `/app`): not recommended without code changes (Vite `base`, router `basename`, and PWA `start_url`/icon paths).

### If cPanel blocks your ZIP/RAR as a “virus”

Some shared hosts run aggressive malware scanners (often showing signatures like `Sanesecurity.*`). This commonly triggers **false positives** when an archive contains `node_modules/` (lots of minified JS).

Best practices:

1. **Do not upload `node_modules/`**. Upload only the backend source (`server.js`, `package.json`, `package-lock.json`, `routes/`, `controllers/`, etc.). Then use cPanel’s Node.js App button **Run NPM Install** (or run `npm ci --omit=dev` over SSH) to fetch dependencies on the server.
2. Prefer **Git deployment** (cPanel “Git Version Control” / “Deploy HEAD Commit”) or **SFTP/SSH** upload instead of uploading a single archive in File Manager.
3. If you must upload an archive, create it **from the backend folder but excluding `node_modules/`**.

Example on Windows PowerShell (run from the project root):

```powershell
Remove-Item -Recurse -Force .\backend\node_modules -ErrorAction SilentlyContinue
tar -a -c -f backend-deploy.zip -C . backend
```

If your host still blocks it, contact hosting support and ask them to whitelist the upload or provide the recommended deployment method for Node.js apps on their cPanel.
