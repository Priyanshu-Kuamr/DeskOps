<div align="center">

# 🗂️ DeskOps

### Team work management, all in one place.

Organize teams, assign work, track progress, and keep every conversation attached to the task it belongs to.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Usage](#-using-deskops) · [Testing](#-testing--build) · [Notes](#-design--implementation-notes)

</div>

---

## 📖 Overview

**DeskOps** is a full-stack web application for managing team work. Create teams, add work items, assign them to teammates, set priorities and due dates, and collaborate through comments and activity history.

The interface is a dark dashboard with summary cards, searchable and filterable work items, and a team-members view.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🔐 | **Authentication** | Register and sign in to access protected features. |
| 👥 | **Team workspaces** | Create teams and view the teams you belong to. |
| 📋 | **Work-item management** | Create, view, edit, and track work items. |
| 🚦 | **Status & priority** | Statuses: `Open`, `In Progress`, `Blocked`, `Done`. Priorities: `Low`, `Medium`, `High`, `Urgent`. |
| 📅 | **Assignments & due dates** | Assign work to team members and set due dates. |
| 🔎 | **Search & filters** | Find work items and filter the dashboard by status and priority. |
| 💬 | **Comments & activity** | Discussion and change history stay attached to the relevant item. |
| 🧑‍🤝‍🧑 | **Team members** | View members and their team roles. |
| 📊 | **Dashboard summaries** | Total, in-progress, completed, and overdue work items at a glance. |
| 🗄️ | **Database migrations** | Schema changes managed with Alembic. |
| ✅ | **Automated tests** | Backend tests cover authentication, teams, and work items. |

---

## 🧰 Tech Stack

| Area | Technologies |
|---|---|
| **Frontend** | React, Vite, JavaScript, CSS |
| **Backend** | Python, FastAPI |
| **Database** | PostgreSQL |
| **ORM & Migrations** | SQLAlchemy, Alembic |
| **Authentication** | JWT-based auth, password hashing |
| **API Testing** | pytest, HTTPX |

---

## 📁 Project Structure

```text
DeskOps/
├── backend/
│   ├── app/
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── teams.py
│   │   └── work_items.py
│   ├── alembic/
│   │   └── versions/
│   ├── tests/
│   ├── alembic.ini
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/
    │   ├── Dashboard.jsx
    │   ├── TaskDetails.jsx
    │   ├── Login.jsx
    │   └── Register.jsx
    ├── package.json
    └── vite.config.js
```

> [!NOTE]
> File placement may vary slightly in the submitted archive. Run commands from the directories that contain the corresponding `requirements.txt`, `alembic.ini`, and `package.json`.

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.11 or a compatible version supported by the dependencies
- **Node.js** and **npm**
- **PostgreSQL**
- **Git**

### 1. Clone the repository

```bash
git clone https://github.com/Priyanshu-Kuamr/DeskOps.git
cd DeskOps
```

### 2. Configure the database and environment

Create a PostgreSQL database for the app (for example, `opsflow`), then add a `.env` file inside the `backend/` directory:

```env
DATABASE_URL=postgresql+psycopg://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/opsflow
JWT_SECRET_KEY=replace_with_a_long_random_secret
```

> [!WARNING]
> Replace the example credentials with your own local PostgreSQL credentials and generate a unique `JWT_SECRET_KEY`. **Never commit real credentials or secrets to Git.**

### 3. Start the backend

From the `backend/` directory:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

<table>
<tr><th>Windows (PowerShell)</th><th>macOS / Linux</th></tr>
<tr>
<td>

```powershell
.\.venv\Scripts\Activate.ps1
```

</td>
<td>

```bash
source .venv/bin/activate
```

</td>
</tr>
</table>

Install dependencies, run migrations, and start the API:

```bash
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

The API runs at **http://127.0.0.1:8000**. Keep this terminal open while using the frontend.

| Endpoint | Purpose |
|---|---|
| `GET /` | Basic API status |
| `GET /health` | Health check |
| `/docs` | Interactive Swagger documentation ([open](http://127.0.0.1:8000/docs)) |

### 4. Start the frontend

In a **second terminal**, from the `frontend/` directory:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, typically **http://localhost:5173**. The frontend API client is configured to call the backend at `http://127.0.0.1:8000`.

---

## 🧪 Testing & Build

**Backend tests** (run from `backend/` with the virtual environment activated):

```bash
python -m pytest -q
```

**Frontend production build** (run from `frontend/`):

```bash
npm run build
```

The build output is generated in the frontend's `dist/` directory.

---

## 🧭 Using DeskOps

1. **Register** an account and **sign in**.
2. **Create a team** or select one you already belong to.
3. **Create work items** with a title, description, status, priority, optional assignee, and due date.
4. **Search and filter** to find relevant work.
5. **Open a work item** to review its details, comments, and activity history.
6. **Visit the team-members area** to review membership and roles.

> [!NOTE]
> Some team-management actions may require account-administrator permissions. Assignees must belong to the relevant team.

---

## 🏗️ Design & Implementation Notes

- The frontend and backend are **separate applications** that communicate over HTTP.
- **PostgreSQL** stores application data; **Alembic** manages schema evolution.
- **Team membership** controls access to team work.
- Work-item updates include a **version field**, enabling conflict-aware updates.
- Keep local environment files, database credentials, and auth secrets **out of version control**.

For more rationale, see [`ENGINEERING_DECISIONS.md`](ENGINEERING_DECISIONS.md) (if included in the repository).

---

## ⚠️ Known Limitations

- Local development requires a separately running PostgreSQL database and backend API.
- This README covers **local development only**. A production setup would need deployment-specific configuration, secure secret management, HTTPS, and operational monitoring.
- Email delivery, cloud deployment, and external integrations are not documented as configured features.

---

## 📄 License

No license has been specified for this repository yet. Add a license file if you intend to publish or redistribute the project under particular terms.

---

<div align="center">

Built with ❤️ using React, FastAPI, and PostgreSQL

</div>
