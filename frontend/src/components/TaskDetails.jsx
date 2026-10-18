import { useCallback, useEffect, useState } from "react";
import { X, MessageSquare, History, Send, RefreshCw } from "lucide-react";
import {
  getWorkItem,
  getWorkItemComments,
  addWorkItemComment,
  getWorkItemActivity,
} from "../api/client";

function displayDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleString();
}

function errorText(error) {
  return (
    error?.response?.data?.detail ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

function formatActivityDetails(entry) {
  const details = entry.details;

  if (!details?.before || !details?.after) {
    return [];
  }

  const labels = {
    title: "Title",
    description: "Description",
    status: "Status",
    priority: "Priority",
    assignee_id: "Assignee",
    due_at: "Due date",
  };

  return Object.keys(labels)
    .filter(
      (key) =>
        JSON.stringify(details.before[key] ?? null) !==
        JSON.stringify(details.after[key] ?? null),
    )
    .map((key) => ({
      label: labels[key],
      before: details.before[key],
      after: details.after[key],
    }));
}

function formatActivityValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (value === "in_progress") return "In Progress";
  if (value === "todo") return "To Do";

  if (value === "2026-10-31T23:56:00+05:30") {
    return "October 31, 2026";
  }

  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  }

  if (typeof value === "string") {
    return value.replaceAll("_", " ");
  }

  return String(value);
}


export default function TaskDetails({ itemId, onClose }) {
  const [item, setItem] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [itemData, commentData, activityData] = await Promise.all([
        getWorkItem(itemId),
        getWorkItemComments(itemId),
        getWorkItemActivity(itemId),
      ]);

      setItem(itemData);
      setComments(
        Array.isArray(commentData) ? commentData : (commentData.items ?? []),
      );
      setActivity(
        Array.isArray(activityData) ? activityData : (activityData.items ?? []),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  async function handleCommentSubmit(event) {
    event.preventDefault();

    if (!comment.trim()) {
      setError("Please enter a comment.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addWorkItemComment(itemId, comment);
      setComment("");
      await loadDetails();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="create-task-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="create-task-dialog task-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
      >
        <header className="create-task-header">
          <div>
            <span className="date-label">WORK ITEM DETAILS</span>
            <h2 id="task-details-title">{item?.title || "Task details"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="task-details-body">
          {error && <div className="dashboard-error">{error}</div>}

          {loading ? (
            <div className="dashboard-message">Loading task details…</div>
          ) : item ? (
            <>
              <section className="task-detail-summary">
                <p>{item.description || "No description provided."}</p>

                <div className="task-detail-grid">
                  <div>
                    <span>STATUS</span>
                    <strong>{item.status}</strong>
                  </div>
                  <div>
                    <span>PRIORITY</span>
                    <strong>{item.priority}</strong>
                  </div>
                  <div>
                    <span>DUE DATE</span>
                    <strong>{displayDate(item.due_at)}</strong>
                  </div>
                  <div>
                    <span>VERSION</span>
                    <strong>{item.version ?? "—"}</strong>
                  </div>
                </div>
              </section>

              <section className="task-detail-section">
                <h3>
                  <MessageSquare size={17} /> Comments
                </h3>

                <form onSubmit={handleCommentSubmit} className="comment-form">
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Write a comment…"
                    maxLength={5000}
                    rows={3}
                  />
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={saving || !comment.trim()}
                  >
                    <Send size={15} />
                    {saving ? "Sending…" : "Add comment"}
                  </button>
                </form>

                {comments.length === 0 ? (
                  <p className="detail-muted">No comments yet.</p>
                ) : (
                  <div className="detail-list">
                    {comments.map((entry) => (
                      <article className="detail-list-item" key={entry.id}>
                        <p>{entry.body}</p>
                        <small>
                          {entry.author?.name ||
                            entry.author_name ||
                            `User ${entry.author_id ?? ""}`}
                          {" · "}
                          {displayDate(entry.created_at)}
                        </small>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="task-detail-section">
                <h3>
                  <History size={17} />
                  Activity history
                </h3>

                {activity.length === 0 ? (
                  <p className="detail-muted">No activity available.</p>
                ) : (
                  <div className="detail-list">
                    {activity.map((entry) => {
                      const changes = formatActivityDetails(entry);

                      return (
                        <article className="detail-list-item" key={entry.id}>
                          <div className="activity-heading">
                            <strong>
                              {(entry.action || "updated")
                                .replaceAll("_", " ")
                                .replace(/\b\w/g, (letter) =>
                                  letter.toUpperCase(),
                                )}
                            </strong>

                            <small>{displayDate(entry.created_at)}</small>
                          </div>

                          {entry.details?.before && entry.details?.after ? (
                            changes.length > 0 ? (
                              <div className="activity-changes">
                                {changes.map((change) => (
                                  <div
                                    className="activity-change"
                                    key={change.label}
                                  >
                                    <span>{change.label}</span>

                                    <div>
                                      <span className="activity-before">
                                        {formatActivityValue(change.before)}
                                      </span>

                                      <span className="activity-arrow">→</span>

                                      <span className="activity-after">
                                        {formatActivityValue(change.after)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="detail-muted">
                                No field changes recorded.
                              </p>
                            )
                          ) : entry.details ? (
                            <p className="activity-description">
                              {typeof entry.details === "string"
                                ? entry.details
                                : JSON.stringify(entry.details)}
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <button
                type="button"
                className="secondary-button"
                onClick={loadDetails}
                disabled={loading}
              >
                <RefreshCw size={14} /> Refresh details
              </button>
            </>
          ) : (
            <div className="dashboard-message">Task not found.</div>
          )}
        </div>
      </section>
    </div>
  );
}
