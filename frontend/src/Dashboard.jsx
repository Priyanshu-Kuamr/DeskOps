import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Settings,
  Search,
  Plus,
  RefreshCw,
  LogOut,
  X,
  Pencil,
  CalendarDays,
  Clock3,
  CircleCheck,
  CircleAlert,
  MessageSquare,
  UserPlus,
  ShieldCheck,
} from "lucide-react";

import {
  getTeams,
  getWorkItems,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  createTeam,
  addTeamMember,
  logoutUser,
} from "./api/client";

import TaskDetails from "./components/TaskDetails";
import "./App.css";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function errorMessage(error) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  if (error?.response?.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (error?.response?.status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (error?.response?.status === 404) {
    return "Resource not found or access denied.";
  }

  if (error?.response?.status === 409) {
    return "This item already exists or conflicts with existing data.";
  }

  return error?.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(item) {
  return (
    item.due_at &&
    item.status !== "done" &&
    new Date(item.due_at).getTime() < Date.now()
  );
}

function initials(value) {
  return String(value || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ErrorMessage({ message }) {
  if (!message) return null;

  return (
    <div className="dashboard-error" role="alert">
      <CircleAlert size={18} />
      <span>{message}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="work-item-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/* create team form */

function CreateTeamForm({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const teamName = name.trim();

    if (teamName.length < 2) {
      setError("Team name must contain at least 2 characters.");
      return;
    }

    if (teamName.length > 100) {
      setError("Team name cannot exceed 100 characters.");
      return;
    }

    setSaving(true);

    try {
      const createdTeam = await createTeam({ name: teamName });
      await onCreated(createdTeam);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="create-task-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="create-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-team-title"
      >
        <div className="create-task-header">
          <div>
            <h2 id="create-team-title">Create a team</h2>
            <p className="dialog-subtitle">
              Set up a workspace for your team's tasks.
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            <X size={18} />
          </button>
        </div>

        <form className="create-task-form" onSubmit={handleSubmit}>
          <Field label="Team name *">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Engineering"
              minLength={2}
              maxLength={100}
              autoFocus
              required
            />
          </Field>

          <ErrorMessage message={error} />

          <div className="create-task-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button" disabled={saving}>
              <Plus size={17} />
              {saving ? "Creating..." : "Create team"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* team member mangaement */

function TeamMemberPanel({ user, activeTeam }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAccountAdmin = user?.account_role === "admin";

  useEffect(() => {
    setEmail("");
    setRole("member");
    setMessage("");
    setError("");
  }, [activeTeam?.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!activeTeam?.id) {
      setError("Select a team first.");
      return;
    }

    const memberEmail = email.trim();

    if (!memberEmail) {
      setError("Enter the email address of a registered user.");
      return;
    }

    setSaving(true);

    try {
      const added = await addTeamMember(activeTeam.id, memberEmail, role);

      setMessage(
        `${added.name || added.email} was added to ${activeTeam.name}.`,
      );
      setEmail("");
      setRole("member");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isAccountAdmin) {
    return null;
  }

  return (
    <section className="tasks-section team-members-section" id="team-members">
      <div className="section-heading">
        <div>
          <h2>
            <Users
              size={20}
              style={{ verticalAlign: "middle", marginRight: 8 }}
            />
            Team members
          </h2>
          <p>
            Add registered users to {activeTeam?.name || "the selected team"}.
          </p>
        </div>

        <ShieldCheck size={24} />
      </div>

      <form className="create-task-form" onSubmit={handleSubmit}>
        <Field label="Registered user's email *">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="colleague@example.com"
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Team role">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="member">Member</option>
            <option value="admin">Team Admin</option>
          </select>
        </Field>

        <ErrorMessage message={error} />

        {message && (
          <p className="success-message" role="status">
            <CircleCheck size={16} />
            {message}
          </p>
        )}

        <div className="create-task-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={saving || !activeTeam?.id}
          >
            <UserPlus size={17} />
            {saving ? "Adding member..." : "Add team member"}
          </button>
        </div>

        <p className="dialog-subtitle">
          The user must already have an OpsFlow account. Account administrator
          access is separate from the team role.
        </p>
      </form>
    </section>
  );
}

/* work item form */

function WorkItemForm({ item, teamId, onClose, onSaved }) {
  const editing = Boolean(item);

  const [form, setForm] = useState({
    title: item?.title || "",
    description: item?.description || "",
    status: item?.status || "open",
    priority: item?.priority || "medium",
    assignee_id: item?.assignee_id ?? "",
    due_at: item?.due_at
      ? new Date(
          new Date(item.due_at).getTime() -
            new Date(item.due_at).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "",
  });

  const [version, setVersion] = useState(item?.version ?? 1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;

    let cancelled = false;

    async function loadLatestItem() {
      setLoading(true);

      try {
        const fresh = await getWorkItem(item.id);

        if (cancelled) return;

        setVersion(fresh.version ?? item.version ?? 1);

        setForm({
          title: fresh.title || "",
          description: fresh.description || "",
          status: fresh.status || "open",
          priority: fresh.priority || "medium",
          assignee_id: fresh.assignee_id ?? "",
          due_at: fresh.due_at
            ? new Date(
                new Date(fresh.due_at).getTime() -
                  new Date(fresh.due_at).getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16)
            : "",
        });
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLatestItem();

    return () => {
      cancelled = true;
    };
  }, [editing, item?.id]);

  function changeField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const title = form.title.trim();

    if (title.length < 2) {
      setError("The title must contain at least 2 characters.");
      return;
    }

    if (!teamId) {
      setError("Select a team first.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title,
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        version,
        assignee_id: form.assignee_id === "" ? null : Number(form.assignee_id),
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      };

      if (editing) {
        await updateWorkItem(item.id, payload);
      } else {
        await createWorkItem({
          ...payload,
          team_id: teamId,
        });
      }

      await onSaved();
      onClose();
    } catch (err) {
      if (err?.response?.status === 409) {
        setError(
          "Conflict: another user changed this task. Close and reopen it to load the latest version.",
        );
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="create-task-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="create-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-item-form-title"
      >
        <div className="create-task-header">
          <div>
            <h2 id="work-item-form-title">
              {editing ? "Edit work item" : "Create work item"}
            </h2>
            <p className="dialog-subtitle">
              {editing
                ? "Update the task details."
                : "Add a task to your selected team."}
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p>Loading the latest task details...</p>
        ) : (
          <form className="create-task-form" onSubmit={handleSubmit}>
            <Field label="Title *">
              <input
                name="title"
                value={form.title}
                onChange={changeField}
                placeholder="e.g. Implement login page"
                minLength={2}
                maxLength={200}
                required
                autoFocus
              />
            </Field>

            <Field label="Description">
              <textarea
                name="description"
                value={form.description}
                onChange={changeField}
                placeholder="Describe the task..."
                rows={4}
              />
            </Field>

            <div className="create-task-field-row">
              <Field label="Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={changeField}
                >
                  {STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority">
                <select
                  name="priority"
                  value={form.priority}
                  onChange={changeField}
                >
                  {PRIORITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Assignee user ID (optional)">
              <input
                name="assignee_id"
                type="number"
                min="1"
                value={form.assignee_id}
                onChange={changeField}
                placeholder="Enter a team member's user ID"
              />
            </Field>

            <Field label="Due date (optional)">
              <input
                name="due_at"
                type="datetime-local"
                value={form.due_at}
                onChange={changeField}
              />
            </Field>

            <ErrorMessage message={error} />

            <div className="create-task-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving || loading}
              >
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Create task"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

/* sidebar */

function Sidebar({
  user,
  teams,
  activeTeam,
  onTeamChange,
  onLogout,
  onCreateTeam,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">D</div>
        <span>DeskOps</span>
      </div>

      <div className="workspace-label">Workspace</div>

      <div className="workspace-selector">
        <div className="workspace-avatar">
          {initials(activeTeam?.name || "W")}
        </div>

        <div className="workspace-info">
          <strong>{activeTeam?.name || "Your workspace"}</strong>
          <span>{activeTeam?.role || "Workspace"}</span>
        </div>
      </div>

      <label className="workspace-label" htmlFor="team-select">
        Team
      </label>

      <select
        id="team-select"
        className="team-select"
        value={activeTeam?.id ?? ""}
        onChange={(event) =>
          onTeamChange(event.target.value ? Number(event.target.value) : null)
        }
        disabled={!teams.length}
      >
        {!teams.length && <option value="">No teams available</option>}

        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="secondary-button create-team-sidebar-button"
        onClick={onCreateTeam}
      >
        <Plus size={16} />
        Create team
      </button>

      <div className="sidebar-label">Menu</div>

      <nav className="sidebar-nav">
        <a className="nav-item active" href="#dashboard">
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </a>

        <a className="nav-item" href="#tasks">
          <CheckSquare size={18} />
          <span>Work items</span>
        </a>

        <a className="nav-item" href="#team-members">
          <Users size={18} />
          <span>Team members</span>
        </a>

        <a className="nav-item" href="#account">
          <Settings size={18} />
          <span>Account</span>
        </a>
      </nav>

      <div className="sidebar-bottom" id="account">
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {initials(user?.name || user?.email)}
          </div>

          <div className="profile-info">
            <strong>{user?.name || "Your account"}</strong>
            <span>{user?.email || ""}</span>
          </div>
        </div>

        <button type="button" className="logout-button" onClick={onLogout}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* team dashb */

function TeamDashboard({ user, teamId, activeTeam }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsItemId, setDetailsItemId] = useState(null);

  const loadItems = useCallback(async () => {
    if (!teamId) {
      setItems([]);
      setTotal(0);
      setError("");
      return;
    }

    setLoadingItems(true);
    setError("");

    try {
      const result = await getWorkItems({
        teamId,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search,
        page: 1,
        pageSize: 100,
      });

      setItems(result.items || []);
      setTotal(result.total ?? result.items?.length ?? 0);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingItems(false);
    }
  }, [teamId, statusFilter, priorityFilter, search]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const inProgress = items.filter(
    (item) => item.status === "in_progress",
  ).length;

  const completed = items.filter((item) => item.status === "done").length;
  const overdue = items.filter(isOverdue).length;

  return (
    <main className="main-content" id="dashboard">
      <header className="topbar">
        <div className="breadcrumb">Workspace / Dashboard</div>

        <div className="topbar-actions">
          <button
            type="button"
            className="icon-button"
            title="Refresh work items"
            onClick={loadItems}
            disabled={loadingItems}
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateForm(true)}
            disabled={!teamId}
          >
            <Plus size={17} />
            New work item
          </button>
        </div>
      </header>

      <section className="welcome-section">
        <div>
          <p className="eyebrow">TEAM WORKSPACE</p>
          <h1>Welcome back, {user?.name || "there"}</h1>
          <p>
            Manage your work and track progress across{" "}
            {activeTeam?.name || "your team"}.
          </p>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-icon">
            <CheckSquare size={19} />
          </div>
          <div className="metric-label">Total work items</div>
          <div className="metric-value">{total}</div>
          <div className="metric-detail">Matching your filters</div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <Clock3 size={19} />
          </div>
          <div className="metric-label">In progress</div>
          <div className="metric-value">{inProgress}</div>
          <div className="metric-detail">Currently being worked on</div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <CircleCheck size={19} />
          </div>
          <div className="metric-label">Completed</div>
          <div className="metric-value">{completed}</div>
          <div className="metric-detail">Marked as done</div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">
            <CalendarDays size={19} />
          </div>
          <div className="metric-label">Overdue</div>
          <div className="metric-value">{overdue}</div>
          <div className="metric-detail">Past their due date</div>
        </article>
      </section>

      <section className="tasks-section" id="tasks">
        <div className="section-heading">
          <div>
            <h2>Work items</h2>
            <p>Search, filter, create, edit and inspect team tasks.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateForm(true)}
            disabled={!teamId}
          >
            <Plus size={17} />
            Create task
          </button>
        </div>

        <div className="task-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search work items..."
              aria-label="Search work items"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <ErrorMessage message={error} />

        <div className="task-table-wrapper">
          {loadingItems ? (
            <div className="empty-state">Loading work items...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <CheckSquare size={32} />
              <h3>No work items found</h3>
              <p>Create a task or change your search and filters.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowCreateForm(true)}
                disabled={!teamId}
              >
                <Plus size={17} />
                Create your first task
              </button>
            </div>
          ) : (
            <table className="task-table">
              <thead>
                <tr>
                  <th>Work item</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Due date</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="task-title">{item.title}</div>
                      <div className="task-description">
                        {item.description || "No description"}
                      </div>
                    </td>

                    <td>
                      <span className={`status-badge ${item.status}`}>
                        {STATUSES.find((option) => option.value === item.status)
                          ?.label || item.status}
                      </span>
                    </td>

                    <td>
                      <span className={`priority-badge ${item.priority}`}>
                        {PRIORITIES.find(
                          (option) => option.value === item.priority,
                        )?.label || item.priority}
                      </span>
                    </td>

                    <td>
                      {item.assignee_id
                        ? `User #${item.assignee_id}`
                        : "Unassigned"}
                    </td>

                    <td>
                      <span className={isOverdue(item) ? "overdue-date" : ""}>
                        {formatDate(item.due_at)}
                      </span>
                    </td>

                    <td>
                      <div className="work-item-actions">
                        <button
                          type="button"
                          className="icon-button"
                          title="View task details, comments and activity"
                          aria-label={`View details for ${item.title}`}
                          onClick={() => setDetailsItemId(item.id)}
                        >
                          <MessageSquare size={16} />
                        </button>

                        <button
                          type="button"
                          className="icon-button"
                          title="Edit work item"
                          aria-label={`Edit ${item.title}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-footer">
          Showing {items.length} of {total} work items
        </div>
      </section>

      <TeamMemberPanel user={user} activeTeam={activeTeam} />

      {showCreateForm && (
        <WorkItemForm
          teamId={teamId}
          onClose={() => setShowCreateForm(false)}
          onSaved={loadItems}
        />
      )}

      {selectedItem && (
        <WorkItemForm
          item={selectedItem}
          teamId={teamId}
          onClose={() => setSelectedItem(null)}
          onSaved={loadItems}
        />
      )}

      {detailsItemId !== null && (
        <TaskDetails
          itemId={detailsItemId}
          onClose={() => setDetailsItemId(null)}
        />
      )}
    </main>
  );
}

/* main dashb */

export default function Dashboard({ user, onLogout }) {
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    setTeamError("");

    try {
      const result = await getTeams();
      const availableTeams = Array.isArray(result)
        ? result
        : result.items || [];

      setTeams(availableTeams);

      setActiveTeamId((current) => {
        if (
          current != null &&
          availableTeams.some((team) => String(team.id) === String(current))
        ) {
          return current;
        }

        const engineering = availableTeams.find(
          (team) => team.name?.toLowerCase() === "engineering",
        );

        return engineering?.id ?? availableTeams[0]?.id ?? null;
      });

      return availableTeams;
    } catch (err) {
      setTeamError(errorMessage(err));
      throw err;
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    loadTeams().catch(() => {

    });
  }, [loadTeams]);

  async function handleTeamCreated(createdTeam) {
    const availableTeams = await loadTeams();

    const matchingTeam = availableTeams.find(
      (team) =>
        createdTeam?.id != null && String(team.id) === String(createdTeam.id),
    );

    if (matchingTeam) {
      setActiveTeamId(matchingTeam.id);
      return;
    }

    const matchingName = availableTeams.find(
      (team) => team.name?.toLowerCase() === createdTeam?.name?.toLowerCase(),
    );

    if (matchingName) {
      setActiveTeamId(matchingName.id);
    }
  }

  function handleLogout() {
    logoutUser();

    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        teams={teams}
        activeTeam={teams.find(
          (team) => String(team.id) === String(activeTeamId),
        )}
        onTeamChange={setActiveTeamId}
        onLogout={handleLogout}
        onCreateTeam={() => setShowCreateTeam(true)}
      />

      <div className="dashboard-content">
        {teamError && <ErrorMessage message={teamError} />}

        {loadingTeams ? (
          <div className="empty-state">Loading your teams...</div>
        ) : teams.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <h2>No teams available</h2>
            <p>Create a team to start managing work items.</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowCreateTeam(true)}
            >
              <Plus size={17} />
              Create your first team
            </button>
          </div>
        ) : (
          <TeamDashboard
            key={activeTeamId}
            user={user}
            teamId={activeTeamId}
            activeTeam={teams.find(
              (team) => String(team.id) === String(activeTeamId),
            )}
          />
        )}
      </div>

      {showCreateTeam && (
        <CreateTeamForm
          onClose={() => setShowCreateTeam(false)}
          onCreated={handleTeamCreated}
        />
      )}
    </div>
  );
}
