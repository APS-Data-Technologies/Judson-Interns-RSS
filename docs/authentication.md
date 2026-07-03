# Accounts and Authentication

The Accounts module provides email/password login, authenticated user details, logout, role checks, location-aware permission helpers, and Super Admin-only user management.

## API Endpoints

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login/` | Public | Validate credentials and issue a token |
| `GET` | `/api/auth/me/` | Authenticated | Return the current user |
| `POST` | `/api/auth/logout/` | Authenticated | Invalidate the current token |
| `POST` | `/api/auth/change-password/` | Authenticated | Change the current user's password and rotate the token |
| `GET` | `/api/user-locations/` | Super Admin | List active locations for Staff assignment |
| `GET` | `/api/users/` | Super Admin | List users |
| `POST` | `/api/users/` | Super Admin | Create a user |
| `GET` | `/api/users/{id}/` | Super Admin | Retrieve a user |
| `PUT/PATCH` | `/api/users/{id}/` | Super Admin | Update a user |
| `DELETE` | `/api/users/{id}/` | Super Admin | Deactivate a user and invalidate their token |

Login request:

```json
{
  "email": "staff@example.com",
  "password": "account-password"
}
```

Login response:

```json
{
  "token": "generated-token",
  "user": {
    "id": 1,
    "email": "staff@example.com",
    "first_name": "Sample",
    "last_name": "User",
    "role": "staff",
    "location": 1,
    "location_name": "Downtown",
    "is_active": true
  }
}
```

Authenticated API requests use this header:

```text
Authorization: Token generated-token
```

## Role Rules

| Capability | Staff | Admin | Super Admin |
| --- | --- | --- | --- |
| Sign in, sign out, and restore session | Yes | Yes | Yes |
| Change own password | Yes | Yes | Yes |
| Access assigned-location data | Yes | Yes | Yes |
| Access every location | No | Yes | Yes |
| Open application administration | No | Yes | Yes |
| List, create, edit, and deactivate users | No | No | Yes |
| Assign Staff to active locations | No | No | Yes |
| Access Django Admin | No | No | Yes |

Staff creation requires a location. Admin and Super Admin accounts cannot be assigned to one location because they have cross-location access. Deleting a user through the API deactivates the account instead of removing its database record. A Super Admin cannot deactivate or demote their own account.

## Security Behavior

- Passwords are hashed by Django and never returned by the API.
- Django password validators apply when users are created or updated through the API.
- Emails are normalized to lowercase and constrained to be unique case-insensitively.
- Each login replaces the user's previous token.
- Tokens expire after 12 hours by default. Set `AUTH_TOKEN_TTL_HOURS` to change this duration.
- Login attempts are throttled to 10 requests per minute per client.
- Logout, deactivation, and administrative password resets invalidate active tokens.
- Self-service password changes return a replacement token without ending the current session.
- The React application keeps the token in `sessionStorage`, so it is removed when the browser session ends.
- A rejected or expired token automatically clears frontend authentication state and returns the user to login.
- Backend permission classes remain the security boundary; frontend navigation restrictions are only a user-interface convenience.

This internal application intentionally has no public signup. The first Super Admin is created with `createsuperuser`; additional accounts are provisioned by a Super Admin. Forgotten passwords are reset by a Super Admin until an approved email-delivery service is added.

## Database Migration

Apply the built-in token migrations and account email constraint:

```bash
python backend/manage.py migrate
```

The account migration normalizes existing email addresses before adding the case-insensitive uniqueness constraint. If two existing users differ only by email casing, the migration stops and identifies the conflicting user IDs so the data can be corrected first.

## Frontend Flow

1. An unauthenticated visitor opening an application route is redirected to `/login`.
2. The login form sends credentials to `/api/auth/login/`.
3. The token and returned user are stored for the browser session.
4. The shared API client adds the token to authenticated requests.
5. Reloading the page calls `/api/auth/me/` to restore the current user.
6. Every role can open `/account` and change its password.
7. Staff users do not see the Admin navigation item and cannot open `/admin` directly.
8. Admin users can open application administration but cannot access user-management APIs or controls.
9. Super Admin users can manage account roles, locations, status, and password resets from `/admin`.
10. Signing out calls the backend, invalidates the token, clears frontend state, and returns to `/login`.

## Verification

Run the backend tests from the repository root:

```bash
python backend/manage.py test apps.accounts.tests.test_authentication
python backend/manage.py makemigrations --check --dry-run
python backend/manage.py check
```

Run frontend verification:

```bash
cd frontend
npm run lint
npm run build
```
