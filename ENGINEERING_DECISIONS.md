<div align="center">

# 🧭 Engineering Decisions

### The key choices behind DeskOps, why they were made, and what they cost.

[Back to README](README.md)

</div>

---

## 📖 About this document

This document records the main engineering choices made while building **DeskOps**, the reasoning behind them, and the trade-offs accepted for the current project scope. Each entry follows the same format:

- **Decision**: what was chosen
- **Why**: the reasoning behind it
- **Trade-off**: what the choice costs or requires

---

## 🗺️ Decisions at a glance

| # | Area | Decision | Primary benefit |
|---|---|---|---|
| 1 | [Architecture](#1-separate-frontend-and-backend) | React + Vite frontend, FastAPI backend | Clear separation of concerns |
| 2 | [Storage](#2-postgresql-for-persistent-storage) | PostgreSQL via SQLAlchemy | Consistent relational data |
| 3 | [Migrations](#3-alembic-for-schema-changes) | Alembic migrations | Explicit, repeatable schema history |
| 4 | [Authentication](#4-token-based-authentication) | JWT + password hashing | Stateless API authentication |
| 5 | [Access control](#5-team-membership-as-an-access-boundary) | Team membership checks | Team data isolation |
| 6 | [Data model](#6-explicit-work-item-status-and-priority) | Structured status and priority fields | Reliable filters and counts |
| 7 | [Dashboard](#7-search-and-filtering-in-the-dashboard) | Search, filters, summary cards | Fast discovery of work |
| 8 | [Collaboration](#8-comments-and-activity-history) | Comments and activity per work item | Context stays with the task |
| 9 | [Concurrency](#9-version-aware-work-item-updates) | Version field on updates | Detect stale edits |
| 10 | [Testing](#10-automated-backend-tests) | pytest + HTTPX | Regression safety |
| 11 | [Configuration](#11-local-development-configuration) | Environment-based settings | Secrets stay out of source |

---

## 1. Separate frontend and backend

| | |
|---|---|
| **Decision** | Build the UI with React and Vite, and expose application functionality through a FastAPI backend. |
| **Why** | Keeps interface and server-side responsibilities separate. React handles dashboard state and user interactions, while FastAPI handles API requests, validation, authentication, and access checks. |
| **Trade-off** | The two apps must be started separately in local development, and API configuration must stay consistent between them. |

## 2. PostgreSQL for persistent storage

| | |
|---|---|
| **Decision** | Use PostgreSQL as the relational database, accessed through SQLAlchemy. |
| **Why** | DeskOps stores related entities such as users, teams, memberships, and work items. A relational database supports these relationships and helps keep records consistent. |
| **Trade-off** | Developers need a local PostgreSQL instance and valid connection settings before the app can run. |

## 3. Alembic for schema changes

| | |
|---|---|
| **Decision** | Manage schema changes with Alembic migrations rather than relying only on automatic table creation. |
| **Why** | Migrations make schema changes explicit and repeatable, and provide a history that can be applied to another development database. |
| **Trade-off** | Developers must apply migrations during setup and after pulling changes that add one. Models and migrations must be kept in sync. |

## 4. Token-based authentication

| | |
|---|---|
| **Decision** | Use JWT-based authentication with password hashing for account access. |
| **Why** | The frontend can authenticate with the API and send a token with protected requests, without the backend maintaining a traditional server-side session for each user. |
| **Trade-off** | Token storage and expiration need careful handling. Local secrets must be kept private, and a production deployment would need a deliberate token-lifetime, refresh, and secret-management strategy. |

## 5. Team membership as an access boundary

| | |
|---|---|
| **Decision** | Associate users with teams through membership, and check membership or permissions when accessing team resources. |
| **Why** | Work items belong in a team context. Membership checks help prevent users from reaching another team's data simply by guessing an identifier. |
| **Trade-off** | Every API endpoint must consistently enforce access checks. Account-level administrative actions and team-level roles are different concepts and must not be treated as interchangeable. |

## 6. Explicit work-item status and priority

| | |
|---|---|
| **Decision** | Represent status and priority as explicit fields rather than embedding them in free-form descriptions. |
| **Why** | Structured values let the dashboard filter items and calculate summary counts consistently. |
| **Trade-off** | The UI and API must agree on accepted values. Adding a status or priority may require updates to validation, display labels, filters, and tests. |

## 7. Search and filtering in the dashboard

| | |
|---|---|
| **Decision** | Provide a searchable work-item list with status and priority filters, alongside summary cards. |
| **Why** | These are common workflows for a team task board and make it easier to locate work and understand current progress. |
| **Trade-off** | Dashboard counts and visible items must use consistent filtering rules. As data grows, server-side search and pagination may be needed to avoid loading too many records at once. |

## 8. Comments and activity history

| | |
|---|---|
| **Decision** | Keep discussion and work-item activity associated with the relevant work item. |
| **Why** | Comments give task-specific conversation a home, while activity history helps users understand changes without relying entirely on external chat. |
| **Trade-off** | The backend should create activity records consistently. A fuller production version may need clearer event types, retention rules, and pagination for long histories. |

## 9. Version-aware work-item updates

| | |
|---|---|
| **Decision** | Include a version field on work-item updates where supported by the implementation. |
| **Why** | A version can detect when an item has changed since a client last read it, reducing the risk of silently overwriting another user's update. |
| **Trade-off** | The API must check the version and return a clear conflict response when the submitted version is stale. This should be covered by automated tests, because the presence of a version field alone does not guarantee conflict protection. |

## 10. Automated backend tests

| | |
|---|---|
| **Decision** | Use pytest for backend tests, with HTTPX where tests exercise API endpoints. |
| **Why** | Automated tests make it easier to confirm expected behavior after changes to authentication, team access, or work-item logic. |
| **Trade-off** | Tests need predictable configuration and should not depend on personal data or an uncontrolled development database. Coverage is not exhaustive, so manual UI checks and additional tests remain useful. |

## 11. Local development configuration

| | |
|---|---|
| **Decision** | Keep database URLs and authentication secrets in environment configuration instead of hard-coding them in source files. |
| **Why** | Developers can use their own local settings without changing tracked code, and credentials are less likely to be exposed in the repository. |
| **Trade-off** | Each developer must create and configure their own environment file. The example values in the README are placeholders and must never be used as real production secrets. |

---

## 🚧 Scope and known limitations

DeskOps is currently documented as a **local-development project**. The current scope prioritizes core team and work-item workflows over production deployment infrastructure.

### Potential future improvements

> [!NOTE]
> The items below are possible next steps, not claims about existing functionality.

- [ ] Add deployment configuration and a repeatable production release process
- [ ] Add HTTPS, centralized secret management, logging, and operational monitoring for a deployed environment
- [ ] Expand automated tests for authorization boundaries, validation failures, and concurrent edits
- [ ] Add server-side pagination and search if work-item volume grows
- [ ] Define a formal API error format and document all endpoints
- [ ] Add a license if the project is intended for redistribution

---

## 📝 Summary

The design favors a clear separation between frontend and backend, relational data storage, explicit schema migrations, access checks around team resources, and a small set of core work-management features. These choices keep the project understandable and maintainable at its current scope while leaving room for future improvements.
