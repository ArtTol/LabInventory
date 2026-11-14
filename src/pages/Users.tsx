
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../services/api";
import {
  Search,
  UserPlus,
  Pencil,
  UserCheck,
  UserX,
  ShieldCheck,
  Users as UsersIcon,
  X,
} from "lucide-react";

type UserRole = "Admin" | "Chemist";

type User = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLogin: string;
};

const emptyForm = {
  username: "",
  password: "",
  fullName: "",
  email: "",
  role: "Chemist" as UserRole,
};

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
const [newPassword, setNewPassword] = useState("");
const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  async function loadUsers() {
    try {
      setError("");

      const response = await api.get<{
        status: string;
        data: Array<{
          id: number;
          username: string;
          fullName: string;
          email: string | null;
          role: UserRole;
          isActive: boolean;
          lastLogin: string | null;
        }>;
      }>("/users");

      setUsers(
        response.data.map((user) => ({
          id: String(user.id),
          username: user.username,
          fullName: user.fullName,
          email: user.email ?? "",
          role: user.role,
          active: user.isActive,
          lastLogin: user.lastLogin
            ? new Date(user.lastLogin).toLocaleString("uk-UA")
            : "Never",
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users"
      );
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.username.toLowerCase().includes(query) ||
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "All roles" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "All statuses" ||
        (statusFilter === "Active" && user.active) ||
        (statusFilter === "Inactive" && !user.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const activeCount = users.filter((user) => user.active).length;
  const adminCount = users.filter((user) => user.role === "Admin").length;
  const chemistCount = users.filter((user) => user.role === "Chemist").length;

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(user: User) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");
  setSuccess("");

  const username = form.username.trim();
  const password = form.password;
  const fullName = form.fullName.trim();
  const email = form.email.trim();

  if (!username || !fullName || !email) {
    setError("Please complete all required fields.");
    return;
  }

  const duplicateUsername = users.some(
    (user) =>
      user.username.toLowerCase() === username.toLowerCase() &&
      user.id !== editingId
  );

  if (duplicateUsername) {
    setError("This username is already in use.");
    return;
  }

  const duplicateEmail = users.some(
    (user) =>
      user.email.toLowerCase() === email.toLowerCase() &&
      user.id !== editingId
  );

  if (duplicateEmail) {
    setError("This email address is already in use.");
    return;
  }

  if (!editingId && password.length < 12) {
    setError("Password must contain at least 12 characters.");
    return;
  }

  try {
    if (editingId) {
      await api.put(`/users/${editingId}`, {
        username,
        fullName,
        email,
        role: form.role,
      });

      await loadUsers();

      setSuccess("User details updated successfully.");
    } else {
      await api.post("/users", {
        username,
        password,
        fullName,
        email,
        role: form.role,
      });

      await loadUsers();

      setSuccess("New user added successfully.");
    }

    closeModal();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : editingId
          ? "Failed to update user."
          : "Failed to create user."
    );
  }
}


  async function toggleStatus(user: User) {
  if (user.role === "Admin" && user.active) {
    const activeAdmins = users.filter(
      (item) => item.role === "Admin" && item.active
    );

    if (activeAdmins.length <= 1) {
      setError("At least one active administrator must remain.");
      return;
    }
  }

  setError("");
  setSuccess("");

  try {
    await api.patch(`/users/${user.id}/status`, {
      isActive: !user.active,
    });

    await loadUsers();

    setSuccess(
      `${user.fullName} ${user.active ? "deactivated" : "activated"}.`
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to update user status."
    );
  }
}
async function handlePasswordReset(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  const targetUser = passwordUser;

  if (!targetUser) return;

  setError("");
  setSuccess("");

  if (newPassword.length < 12) {
    setError("Password must contain at least 12 characters.");
    return;
  }

  setPasswordSubmitting(true);

  try {
    await api.patch(`/users/${targetUser.id}/password`, {
      password: newPassword,
    });

    setPasswordUser(null);
    setNewPassword("");
    setSuccess(
      `Password for ${targetUser.username} was reset successfully.`
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to reset user password."
    );
  } finally {
    setPasswordSubmitting(false);
  }
}
  return (
    <div className="users-page">
      <div className="page-heading">
        <div>
          <h1>Users</h1>
          <p>Manage user accounts, roles and access status.</p>
        </div>

        <button className="users-add-button" onClick={openAddModal}>
          <UserPlus size={16} />
          Add user
        </button>
      </div>

      <div className="users-summary">
        <div className="users-summary-card">
          <div className="users-summary-icon blue">
            <UsersIcon size={19} />
          </div>
          <div>
            <span>Total users</span>
            <strong>{users.length}</strong>
          </div>
        </div>

        <div className="users-summary-card">
          <div className="users-summary-icon green">
            <UserCheck size={19} />
          </div>
          <div>
            <span>Active users</span>
            <strong>{activeCount}</strong>
          </div>
        </div>

        <div className="users-summary-card">
          <div className="users-summary-icon purple">
            <ShieldCheck size={19} />
          </div>
          <div>
            <span>Administrators</span>
            <strong>{adminCount}</strong>
          </div>
        </div>

        <div className="users-summary-card">
          <div className="users-summary-icon orange">
            <UsersIcon size={19} />
          </div>
          <div>
            <span>Chemists</span>
            <strong>{chemistCount}</strong>
          </div>
        </div>
      </div>

      {success && (
        <div className="users-feedback success">
          <UserCheck size={16} />
          {success}
          <button onClick={() => setSuccess("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {error && !modalOpen && (
        <div className="users-feedback error">
          <UserX size={16} />
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <section className="users-panel">
        <div className="users-toolbar">
          <div className="users-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search username, name or email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
            className="users-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option>All roles</option>
            <option>Admin</option>
            <option>Chemist</option>
          </select>

          <select
            className="users-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All statuses</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="data-table users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table">
                    No users match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="users-person">
                        <div className="users-avatar">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{user.fullName}</strong>
                          <small>{user.id}</small>
                        </div>
                      </div>
                    </td>

                    <td className="users-username">{user.username}</td>
                    <td>{user.email}</td>

                    <td>
                      <span
                        className={`users-role ${
                          user.role === "Admin" ? "admin" : "chemist"
                        }`}
                      >
                        {user.role === "Admin" ? (
                          <ShieldCheck size={12} />
                        ) : (
                          <UsersIcon size={12} />
                        )}
                        {user.role}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`users-status ${
                          user.active ? "active" : "inactive"
                        }`}
                      >
                        <span />
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="users-last-login">{user.lastLogin}</td>

                    <td>
                      <div className="users-actions">
                        <button
                          className="users-action-button edit"
                          onClick={() => openEditModal(user)}
                          title="Edit user"
                          aria-label={`Edit ${user.username}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
  className="users-action-button edit"
  onClick={() => {
    setPasswordUser(user);
    setNewPassword("");
    setError("");
  }}
  title="Reset password"
  aria-label={`Reset password for ${user.username}`}
>
  <ShieldCheck size={14} />
</button>
                        <button
                          className={`users-action-button ${
                            user.active ? "deactivate" : "activate"
                          }`}
                          onClick={() => toggleStatus(user)}
                          title={user.active ? "Deactivate user" : "Activate user"}
                          aria-label={`${
                            user.active ? "Deactivate" : "Activate"
                          } ${user.username}`}
                          disabled={
                            user.role === "Admin" &&
                            user.active &&
                            adminCount <= 1
                          }
                        >
                          {user.active ? (
                            <UserX size={14} />
                          ) : (
                            <UserCheck size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="users-footer">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </section>

      {modalOpen && (
        <div className="users-modal-overlay" onClick={closeModal}>
          <div
            className="users-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal-heading">
              <div>
                <h2>{editingId ? "Edit user" : "Add new user"}</h2>
                <p>
                  {editingId
                    ? "Update account information and role."
                    : "Create a new laboratory user account."}
                </p>
              </div>
              <button
                className="users-modal-close"
                onClick={closeModal}
                type="button"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="users-modal-fields">
                <label className="users-field">
                  <span>Username *</span>
                  <input
                    value={form.username}
                    onChange={(event) =>
                      setForm({ ...form, username: event.target.value })
                    }
                    placeholder="e.g. chemist4"
                    required
                  />
                </label>

                {!editingId && (
                  <label className="users-field">
                    <span>Password *</span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        setForm({ ...form, password: event.target.value })
                      }
                      placeholder="Minimum 12 characters"
                      minLength={12}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                )}

                <label className="users-field">
                  <span>Full name *</span>
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm({ ...form, fullName: event.target.value })
                    }
                    placeholder="Enter full name"
                    required
                  />
                </label>

                <label className="users-field">
                  <span>Email address *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    placeholder="user@lab.local"
                    required
                  />
                </label>

                <label className="users-field">
                  <span>Role *</span>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        role: event.target.value as UserRole,
                      })
                    }
                  >
                    <option value="Chemist">Chemist</option>
                    <option value="Admin">Admin</option>
                  </select>
                </label>
              </div>

              {error && (
                <div className="users-feedback error">
                  <UserX size={15} />
                  {error}
                </div>
              )}

              <div className="users-modal-actions">
                <button
                  type="button"
                  className="users-cancel-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="users-save-button">
                  {editingId ? "Save changes" : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
            {passwordUser && (
        <div
          className="users-modal-overlay"
          onClick={() => {
            if (!passwordSubmitting) {
              setPasswordUser(null);
              setNewPassword("");
            }
          }}
        >
          <div
            className="users-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal-heading">
              <div>
                <h2>Reset password</h2>
                <p>
                  Set a new password for {passwordUser.username}.
                </p>
              </div>
              <button
                className="users-modal-close"
                type="button"
                aria-label="Close"
                disabled={passwordSubmitting}
                onClick={() => {
                  setPasswordUser(null);
                  setNewPassword("");
                  setError("");
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordReset}>
              <div className="users-modal-fields">
                <label className="users-field">
                  <span>New password *</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    placeholder="Minimum 12 characters"
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>

              {error && (
                <div className="users-feedback error">
                  <UserX size={15} />
                  {error}
                </div>
              )}

              <div className="users-modal-actions">
                <button
                  type="button"
                  className="users-cancel-button"
                  disabled={passwordSubmitting}
                  onClick={() => {
                    setPasswordUser(null);
                    setNewPassword("");
                    setError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="users-save-button"
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? "Updating..." : "Reset password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
