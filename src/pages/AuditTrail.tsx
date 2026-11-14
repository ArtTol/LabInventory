
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  ShieldCheck,
  PlusCircle,
  Pencil,
  Trash2,
  LogIn,
  PackagePlus,
  PackageMinus,
  Eye,
  X,
  Filter,
  ClipboardList,
} from "lucide-react";
import { api } from "../services/api";

type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "RECEIPT"
  | "WRITE_OFF"
  | "ACTIVATE"
  | "DEACTIVATE"
  | "PASSWORD_RESET";

type AuditRecord = {
  id: string;
  date: string;
  user: string;
  action: AuditAction;
  entity: string;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  details: string;
};

type AuditApi = {
  id: number | string;
  eventDate: string;
  username: string | null;
  action: AuditAction;
  entityType: string | null;
  recordId: string | null;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
};

const actionLabels: Record<AuditAction, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  LOGIN: "Login",
  RECEIPT: "Receipt",
  WRITE_OFF: "Write-off",
  ACTIVATE: "Activate",
  DEACTIVATE: "Deactivate",
  PASSWORD_RESET: "Password Reset",
};

function AuditTrail() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [entityFilter, setEntityFilter] = useState("All");
  const [selectedRecord, setSelectedRecord] =
    useState<AuditRecord | null>(null);

  useEffect(() => {
    async function loadAuditRecords() {
      try {
        const data = await api.get<AuditApi[]>("/audit-trail");

        const mappedRecords: AuditRecord[] = data.map((item) => {
          const entityNames: Record<string, string> = {
            MATERIAL: "Materials",
            MATERIALS: "Materials",
            LOT: "Lots",
            LOTS: "Lots",
            USER: "Users",
            USERS: "Users",
            AUTHENTICATION: "Authentication",
          };

          const fieldNames: Record<string, string> = {
            current_quantity: "Current Quantity",
            initial_quantity: "Initial Quantity",
            min_stock: "Min Stock",
          };

          return {
            id: String(item.id),
            date: new Date(item.eventDate).toLocaleString(),
            user: item.username || "—",
            action: item.action,
            entity: item.entityType
              ? entityNames[item.entityType.toUpperCase()] ||
                item.entityType
              : "—",
            recordId: item.recordId || "—",
            fieldName: item.fieldName
              ? fieldNames[item.fieldName] || item.fieldName
              : "—",
            oldValue: item.oldValue ?? "—",
            newValue: item.newValue ?? "—",
            details: item.details || "—",
          };
        });

        setRecords(mappedRecords);
      } catch (error) {
        console.error("Failed to load audit records:", error);
      }
    }

    loadAuditRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.toLowerCase().trim();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        record.id.toLowerCase().includes(query) ||
        record.user.toLowerCase().includes(query) ||
        record.entity.toLowerCase().includes(query) ||
        record.recordId.toLowerCase().includes(query) ||
        record.details.toLowerCase().includes(query);

      const matchesAction =
        actionFilter === "All" || record.action === actionFilter;

      const matchesEntity =
        entityFilter === "All" || record.entity === entityFilter;

      return matchesSearch && matchesAction && matchesEntity;
    });
  }, [records, search, actionFilter, entityFilter]);

  const createCount = records.filter(
    (record) => record.action === "CREATE"
  ).length;

  const updateCount = records.filter(
    (record) => record.action === "UPDATE"
  ).length;

  const securityCount = records.filter(
  (record) =>
    record.action === "LOGIN" ||
    record.action === "PASSWORD_RESET"
).length;

  const getActionIcon = (action: AuditAction) => {
    switch (action) {
      case "CREATE":
        return <PlusCircle size={15} />;
      case "UPDATE":
        return <Pencil size={15} />;
      case "DELETE":
        return <Trash2 size={15} />;
      case "LOGIN":
        return <LogIn size={15} />;
      case "RECEIPT":
        return <PackagePlus size={15} />;
      case "WRITE_OFF":
        return <PackageMinus size={15} />;
        case "ACTIVATE":
  return <ShieldCheck size={15} />;
case "DEACTIVATE":
  return <ShieldCheck size={15} />;
case "PASSWORD_RESET":
  return <ShieldCheck size={15} />;
      default:
        return <ClipboardList size={15} />;
        
    }
  };

  const exportCSV = () => {
    const headers = [
      "Audit ID",
      "Date",
      "User",
      "Action",
      "Entity",
      "Record ID",
      "Field",
      "Old Value",
      "New Value",
      "Details",
    ];

    const rows = filteredRecords.map((record) => [
      record.id,
      record.date,
      record.user,
      record.action,
      record.entity,
      record.recordId,
      record.fieldName,
      record.oldValue,
      record.newValue,
      record.details,
    ]);

    const escapeCSV = (value: string) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "audit-trail.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setActionFilter("All");
    setEntityFilter("All");
  };

  return (
    <div className="audit-page">
      <div className="page-heading">
        <div>
          <h1>Audit Trail</h1>
          <p>Track and review all system activities.</p>
        </div>

        <button className="audit-export-button" onClick={exportCSV}>
          <Download size={17} />
          Export CSV
        </button>
      </div>

      <div className="audit-summary">
        <div className="audit-summary-card">
          <div className="audit-summary-icon total">
            <ClipboardList size={20} />
          </div>
          <div>
            <span>Total Events</span>
            <strong>{records.length}</strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <div className="audit-summary-icon create">
            <PlusCircle size={20} />
          </div>
          <div>
            <span>Created Records</span>
            <strong>{createCount}</strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <div className="audit-summary-icon update">
            <Pencil size={20} />
          </div>
          <div>
            <span>Updated Records</span>
            <strong>{updateCount}</strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <div className="audit-summary-icon security">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span>Security Events</span>
            <strong>{securityCount}</strong>
          </div>
        </div>
      </div>

      <div className="audit-panel">
        <div className="audit-panel-heading">
          <div>
            <h2>Activity History</h2>
            <p>Review system events and changes.</p>
          </div>
          <span className="audit-record-count">
            {filteredRecords.length} records
          </span>
        </div>

        <div className="audit-toolbar">
          <div className="audit-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by user, ID or details..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="audit-filter">
            <Filter size={16} />
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              <option value="All">All actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="LOGIN">Login</option>
              <option value="RECEIPT">Receipt</option>
              <option value="WRITE_OFF">Write-off</option>
              <option value="ACTIVATE">Activate</option>
              <option value="DEACTIVATE">Deactivate</option>
              <option value="PASSWORD_RESET">Password Reset</option>
            </select>
          </div>

          <div className="audit-filter">
            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
            >
              <option value="All">All entities</option>
              <option value="Materials">Materials</option>
              <option value="Lots">Lots</option>
              <option value="Users">Users</option>
              <option value="Authentication">Authentication</option>
            </select>
          </div>

          <button
            className="audit-clear-button"
            onClick={clearFilters}
          >
            <X size={15} />
            Clear
          </button>
        </div>

        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Record ID</th>
                <th>Details</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td className="audit-date">{record.date}</td>
                  <td>
                    <span className="audit-user">{record.user}</span>
                  </td>
                  <td>
                    <span className={`audit-action ${record.action.toLowerCase()}`}>
                      {getActionIcon(record.action)}
                      {actionLabels[record.action]}
                    </span>
                  </td>
                  <td>{record.entity}</td>
                  <td>
                    <span className="audit-record-id">
                      {record.recordId}
                    </span>
                  </td>
                  <td className="audit-details-cell">
                    {record.details}
                  </td>
                  <td>
                    <button
                      className="audit-view-button"
                      title="View details"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRecords.length === 0 && (
            <div className="audit-empty">
              <ClipboardList size={30} />
              <strong>No audit records found</strong>
              <span>Try changing your search or filters.</span>
            </div>
          )}
        </div>

        <div className="audit-footer">
          Showing {filteredRecords.length} of {records.length} records
        </div>
      </div>

      {selectedRecord && (
        <div
          className="audit-modal-overlay"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="audit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="audit-modal-heading">
              <div>
                <h2>Event Details</h2>
                <p>{selectedRecord.id}</p>
              </div>

              <button
                className="audit-modal-close"
                onClick={() => setSelectedRecord(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="audit-detail-grid">
              <div>
                <span>Date & Time</span>
                <strong>{selectedRecord.date}</strong>
              </div>

              <div>
                <span>User</span>
                <strong>{selectedRecord.user}</strong>
              </div>

              <div>
                <span>Action</span>
                <strong>{actionLabels[selectedRecord.action]}</strong>
              </div>

              <div>
                <span>Entity</span>
                <strong>{selectedRecord.entity}</strong>
              </div>

              <div>
                <span>Record ID</span>
                <strong>{selectedRecord.recordId}</strong>
              </div>

              <div>
                <span>Changed Field</span>
                <strong>{selectedRecord.fieldName}</strong>
              </div>
            </div>

            <div className="audit-change-section">
              <h3>Change Details</h3>

              <div className="audit-change-row">
                <span>Previous Value</span>
                <strong>{selectedRecord.oldValue}</strong>
              </div>

              <div className="audit-change-row">
                <span>New Value</span>
                <strong>{selectedRecord.newValue}</strong>
              </div>
            </div>

            <div className="audit-description">
              <span>Description</span>
              <p>{selectedRecord.details}</p>
            </div>

            <div className="audit-modal-actions">
              <button onClick={() => setSelectedRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="audit-demo-notice">
        <ShieldCheck size={17} />
        <span>
          Audit events are loaded from the database and stored by the backend.
        </span>
      </div>
    </div>
  );
}

export default AuditTrail;
