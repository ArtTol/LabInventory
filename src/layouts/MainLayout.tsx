
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FlaskConical, Package, Warehouse,
  PackagePlus, ClipboardMinus, ArrowLeftRight,
  Users, History, Search, Bell, Settings, ChevronDown
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "INVENTORY",
    items: [
      { label: "Materials", path: "/materials", icon: FlaskConical },
      { label: "Lots", path: "/lots", icon: Package },
      { label: "Stock", path: "/stock", icon: Warehouse },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Receive", path: "/receive", icon: PackagePlus },
      { label: "Write-off", path: "/use", icon: ClipboardMinus },
      { label: "Movements", path: "/movements", icon: ArrowLeftRight },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { label: "Users", path: "/users", icon: Users },
      { label: "Audit Trail", path: "/audit", icon: History },
    ],
  },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.fullName || user?.username || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><FlaskConical size={23} /></div>
          <div>
            <h2>LabInventory</h2>
            <span>LABORATORY SYSTEM</span>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">L</div>
          <div className="workspace-info">
            <strong>Laboratory</strong>
            <span>Inventory workspace</span>
          </div>
          <ChevronDown size={16} />
        </div>

        <nav className="navigation">
          {navigation
            .filter(
              (group) =>
                group.title !== "ADMINISTRATION" ||
                user?.role === "Admin"
            )
            .map((group) => (
              <div className="nav-group" key={group.title}>
                <div className="nav-title">{group.title}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? "active" : ""}`
                      }
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <strong>{user?.fullName || user?.username}</strong>
            <span>{user?.role === "Admin" ? "System Admin" : "Chemist"}</span>
          </div>
          <Settings size={17} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Laboratory</span>
            <span className="breadcrumb-separator">/</span>
            <strong>Inventory Management</strong>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search">
              <Search size={19} />
            </button>
            <button className="icon-button notification" aria-label="Notifications">
              <Bell size={19} />
              <span />
            </button>
            <div className="topbar-divider" />
            <button
              className="topbar-user"
              type="button"
              onClick={handleLogout}
              title="Sign out"
            >
              <div className="user-avatar small">{initials}</div>
              <div>
                <strong>{user?.fullName || user?.username}</strong>
                <span>{user?.role === "Admin" ? "Admin account" : "Chemist account"}</span>
              </div>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
