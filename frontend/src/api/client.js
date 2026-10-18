import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("opsflow_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function registerUser({ name, email, password }) {
  const response = await api.post("/auth/register", {
    name,
    email,
    password,
  });

  return response.data;
}

export async function loginUser(email, password) {
  const body = new URLSearchParams();

  body.append("username", email);
  body.append("password", password);
  body.append("grant_type", "password");

  const response = await api.post("/auth/login", body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const token = response.data.access_token;

  if (!token) {
    throw new Error("The server did not return an access token.");
  }

  localStorage.setItem("opsflow_token", token);

  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data;
}

export function logoutUser() {
  localStorage.removeItem("opsflow_token");
}

export async function getTeams() {
  const response = await api.get("/teams/");
  return response.data;
}

export async function getWorkItems({
  teamId,
  status,
  priority,
  search,
  page = 1,
  pageSize = 20,
}) {
  const params = {
    team_id: teamId,
    page,
    page_size: pageSize,
  };

  if (status) params.status = status;
  if (priority) params.priority = priority;

  if (search?.trim()) {
    params.search = search.trim();
  }

  const response = await api.get("/work-items/", { params });

  return response.data;
}

export async function createWorkItem({
  title,
  description = "",
  team_id,
  assignee_id,
  status = "open",
  priority = "medium",
  due_at,
}) {
  const payload = {
    title: title.trim(),
    description: description.trim(),
    team_id: Number(team_id),
    status,
    priority,
  };

  if (assignee_id !== "" && assignee_id != null) {
    payload.assignee_id = Number(assignee_id);
  }

  if (due_at) {
    payload.due_at = new Date(due_at).toISOString();
  }

  const response = await api.post("/work-items/", payload);

  return response.data;
}

export async function getWorkItem(itemId) {
  const response = await api.get(`/work-items/${itemId}`);
  return response.data;
}

export async function updateWorkItem(itemId, changes) {
  const payload = { ...changes };

  if (payload.due_at) {
    payload.due_at = new Date(payload.due_at).toISOString();
  }

  if (payload.assignee_id === "") {
    payload.assignee_id = null;
  } else if (payload.assignee_id != null) {
    payload.assignee_id = Number(payload.assignee_id);
  }

  const response = await api.patch(`/work-items/${itemId}`, payload);

  return response.data;
}

export async function getWorkItemComments(itemId) {
  const response = await api.get(`/work-items/${itemId}/comments`);

  return response.data;
}

export async function addWorkItemComment(itemId, body) {
  const response = await api.post(`/work-items/${itemId}/comments`, {
    body: body.trim(),
  });

  return response.data;
}

export async function getWorkItemActivity(itemId) {
  const response = await api.get(`/work-items/${itemId}/activity`);

  return response.data;
}

export async function createTeam(teamData) {
  const name =
    typeof teamData === "string" ? teamData : teamData?.name;

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Please enter a valid team name.");
  }

  const response = await api.post("/teams/", {
    name: name.trim(),
  });

  return response.data;
}

export async function addTeamMember(teamId, email, role = "member") {
  const response = await api.post(`/teams/${teamId}/members`, {
    email: email.trim(),
    role,
  });

  return response.data;
}

export default api;
