
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Search, Plus, Download, Eye, Pencil, X, Package,
  CalendarDays, AlertTriangle, CheckCircle2
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type LotStatus = "Active" | "Expired" | "Depleted";

type Lot = {
  id: string;
  lotNumber: string;
  materialId: number;
  material: string;
  receivedDate: string;
  expiryDate: string;
  initialQuantity: number;
  currentQuantity: number;
  unit: string;
  storage: string;
  status: LotStatus;
};

type LotApi = {
  id: number;
  lotNumber: string;
  materialId: number;
  material: string;
  receivedDate: string;
  expiryDate: string;
  initialQuantity: number | string;
  currentQuantity: number | string;
  unit: string;
  storage: string | null;
  status: string;
};

type MaterialApi = {
  id: number;
  name: string;
  unit: string;
  isActive: boolean;
  storageConditions: string | null;
};

type LotForm = {
  lotNumber: string;
  materialId: string;
  receivedDate: string;
  expiryDate: string;
  initialQuantity: string;
  currentQuantity: string;
  storage: string;
};

function mapLot(item: LotApi): Lot {
  const status = item.status.toUpperCase();

  return {
    id: String(item.id),
    lotNumber: item.lotNumber,
    materialId: Number(item.materialId),
    material: item.material,
    receivedDate: String(item.receivedDate).slice(0, 10),
    expiryDate: String(item.expiryDate).slice(0, 10),
    initialQuantity: Number(item.initialQuantity),
    currentQuantity: Number(item.currentQuantity),
    unit: item.unit,
    storage: item.storage || "",
    status:
      status === "DEPLETED"
        ? "Depleted"
        : status === "EXPIRED"
          ? "Expired"
          : "Active",
  };
}

const emptyForm: LotForm = {
  lotNumber: "",
  materialId: "",
  receivedDate: "",
  expiryDate: "",
  initialQuantity: "",
  currentQuantity: "",
  storage: "",
};

function Lots() {
  const { user } = useAuth();
const isAdmin = user?.role === "Admin";
  const [lots, setLots] = useState<Lot[]>([]);
  const [materials, setMaterials] = useState<MaterialApi[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [viewLot, setViewLot] = useState<Lot | null>(null);
  const [form, setForm] = useState<LotForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [lotsResult, materialsResult] = await Promise.all([
        api.get<LotApi[]>("/lots"),
        api.get<MaterialApi[]>("/materials"),
      ]);

      setLots(lotsResult.map(mapLot));
      setMaterials(materialsResult.filter((item) => item.isActive));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedMaterial = materials.find(
    (item) => String(item.id) === form.materialId
  );

  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      const term = search.toLowerCase();

      const matchesSearch =
        lot.lotNumber.toLowerCase().includes(term) ||
        lot.material.toLowerCase().includes(term) ||
        lot.id.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "All" || lot.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [lots, search, statusFilter]);

  const activeCount = lots.filter((lot) => lot.status === "Active").length;
  const expiredCount = lots.filter((lot) => lot.status === "Expired").length;
  const depletedCount = lots.filter((lot) => lot.status === "Depleted").length;

  function openAddModal() {
    setSelectedLot(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(lot: Lot) {
    setSelectedLot(lot);
    setForm({
      lotNumber: lot.lotNumber,
      materialId: String(lot.materialId),
      receivedDate: lot.receivedDate,
      expiryDate: lot.expiryDate,
      initialQuantity: String(lot.initialQuantity),
      currentQuantity: String(lot.currentQuantity),
      storage: lot.storage,
    });
    setError("");
    setModalOpen(true);
  }

  async function saveLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const initial = Number(form.initialQuantity);
    const current = Number(form.currentQuantity);
    const materialId = Number(form.materialId);

    if (
      !form.lotNumber.trim() ||
      !Number.isInteger(materialId) ||
      !form.receivedDate ||
      !form.expiryDate ||
      !Number.isFinite(initial) ||
      !Number.isFinite(current) ||
      initial < 0 ||
      current < 0 ||
      current > initial
    ) {
      setError("Please check the required fields and quantities.");
      return;
    }

    if (form.expiryDate < form.receivedDate) {
      setError("Expiry date cannot be earlier than received date.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      lotNumber: form.lotNumber.trim(),
      materialId,
      receivedDate: form.receivedDate,
      expiryDate: form.expiryDate,
      initialQuantity: initial,
      currentQuantity: current,
      storage: form.storage.trim(),
    };

    try {
      if (selectedLot) {
        await api.put(`/lots/${selectedLot.id}`, payload);
      } else {
        await api.post("/lots", payload);
      }

      await loadData();
      setModalOpen(false);
      setSelectedLot(null);
      setForm(emptyForm);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save lot."
      );
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const headers = [
      "Lot ID", "Lot Number", "Material", "Received Date",
      "Expiry Date", "Initial Quantity", "Current Quantity",
      "Unit", "Storage", "Status"
    ];

    const rows = filteredLots.map((lot) => [
      lot.id, lot.lotNumber, lot.material, lot.receivedDate,
      lot.expiryDate, lot.initialQuantity, lot.currentQuantity,
      lot.unit, lot.storage, lot.status
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) =>
          `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lab-inventory-lots.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function getStatusLabel(status: LotStatus) {
    return status;
  }

  return (
    <div className="lots-page">
      <div className="page-heading">
        <div>
          <h1>Lots</h1>
          <p>Manage reagent batches, expiry dates and quantities.</p>
        </div>
        <button
          className="primary-button"
          onClick={openAddModal}
          disabled={materials.length === 0}
        >
          <Plus size={16} /> Add lot
        </button>
      </div>

      <div className="lot-summary">
        <div className="lot-summary-card">
          <div className="lot-summary-icon blue"><Package size={19} /></div>
          <div><span>Total lots</span><strong>{lots.length}</strong></div>
        </div>
        <div className="lot-summary-card">
          <div className="lot-summary-icon green"><CheckCircle2 size={19} /></div>
          <div><span>Active lots</span><strong>{activeCount}</strong></div>
        </div>
        <div className="lot-summary-card">
          <div className="lot-summary-icon red"><AlertTriangle size={19} /></div>
          <div><span>Expired lots</span><strong>{expiredCount}</strong></div>
        </div>
        <div className="lot-summary-card">
          <div className="lot-summary-icon gray"><Package size={19} /></div>
          <div><span>Depleted lots</span><strong>{depletedCount}</strong></div>
        </div>
      </div>

      <section className="panel lots-panel">
        <div className="lots-toolbar">
          <div className="lot-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by lot number, material or ID..."
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={15} />
              </button>
            )}
          </div>

          <select
            className="lot-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Depleted">Depleted</option>
          </select>

          <button className="secondary-button" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
        </div>

        {error && !modalOpen && (
          <div className="error-message">{error}</div>
        )}

        <div className="table-responsive">
          <table className="data-table lots-table">
            <thead>
              <tr>
                <th>Lot number</th>
                <th>Material</th>
                <th>Received</th>
                <th>Expiry date</th>
                <th>Initial qty.</th>
                <th>Current qty.</th>
                <th>Storage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty-table">
                    Loading lots...
                  </td>
                </tr>
              ) : filteredLots.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <div className="lot-number-cell">
                      <strong>{lot.lotNumber}</strong>
                      <span>{lot.id}</span>
                    </div>
                  </td>
                  <td className="lot-material">{lot.material}</td>
                  <td>{lot.receivedDate}</td>
                  <td>
                    <span className={
                      lot.expiryDate < new Date().toISOString().slice(0, 10)
                        ? "expiry-date expired-date"
                        : "expiry-date"
                    }>
                      <CalendarDays size={13} /> {lot.expiryDate}
                    </span>
                  </td>
                  <td>{lot.initialQuantity.toLocaleString()} {lot.unit}</td>
                  <td>
                    <strong className="quantity-value">
                      {lot.currentQuantity.toLocaleString()} {lot.unit}
                    </strong>
                  </td>
                  <td>{lot.storage}</td>
                  <td>
                    <span className={`lot-status ${lot.status.toLowerCase()}`}>
                      <span /> {getStatusLabel(lot.status)}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button title="View lot" onClick={() => setViewLot(lot)}>
                        <Eye size={15} />
                      </button>
                     {isAdmin && (
  <button title="Edit lot" onClick={() => openEditModal(lot)}>
    <Pencil size={15} />
  </button>
)}
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredLots.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-table">
                    No lots found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing <strong>{filteredLots.length}</strong> of{" "}
            <strong>{lots.length}</strong> lots
          </span>
          <span>Connected to PostgreSQL</span>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="material-modal lot-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{selectedLot ? "Edit lot" : "Add new lot"}</h2>
                <p>Enter batch information and quantities.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveLot}>
              <div className="form-grid">
                <label className="form-field">
                  Lot number *
                  <input
                    required
                    value={form.lotNumber}
                    onChange={(e) =>
                      setForm({ ...form, lotNumber: e.target.value })
                    }
                    placeholder="e.g. ACN-2026-015"
                  />
                </label>

                <label className="form-field">
                  Material *
                  <select
                    required
                    value={form.materialId}
                    onChange={(e) => {
                      const material = materials.find(
                        (item) => String(item.id) === e.target.value
                      );

                      setForm({
                        ...form,
                        materialId: e.target.value,
                        storage: material?.storageConditions || "",
                      });
                    }}
                  >
                    <option value="">Select material</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  Received date *
                  <input
                    required
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) =>
                      setForm({ ...form, receivedDate: e.target.value })
                    }
                  />
                </label>

                <label className="form-field">
                  Expiry date *
                  <input
                    required
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) =>
                      setForm({ ...form, expiryDate: e.target.value })
                    }
                  />
                </label>

                <label className="form-field">
                  Initial quantity *
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    disabled={!!selectedLot}
                    value={form.initialQuantity}
                    onChange={(e) =>
                      setForm({ ...form, initialQuantity: e.target.value })
                    }
                  />
                </label>

                <label className="form-field">
                  Current quantity *
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    disabled={!!selectedLot}
                    value={form.currentQuantity}
                    onChange={(e) =>
                      setForm({ ...form, currentQuantity: e.target.value })
                    }
                  />
                </label>

                <label className="form-field">
                  Unit
                  <input
                    readOnly
                    value={selectedMaterial?.unit || ""}
                    placeholder="Select a material"
                  />
                </label>

                <label className="form-field">
  Storage conditions
  <select
    value={form.storage}
    onChange={(e) =>
      setForm({ ...form, storage: e.target.value })
    }
  >
    <option value="Room temperature">Room temperature</option>
    <option value="Refrigerated (2–8°C)">Refrigerated (2–8°C)</option>
    <option value="Frozen">Frozen</option>
    <option value="Flammable cabinet">Flammable cabinet</option>
    <option value="Acid cabinet">Acid cabinet</option>
    <option value="Dry storage">Dry storage</option>
  </select>
</label>
              </div>

              {error && (
                <div className="error-message">{error}</div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving || materials.length === 0}
                >
                  {saving
                    ? "Saving..."
                    : selectedLot
                      ? "Save changes"
                      : "Add lot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewLot && (
        <div className="modal-overlay" onClick={() => setViewLot(null)}>
          <div
            className="material-modal lot-details-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Lot details</h2>
                <p>{viewLot.lotNumber}</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setViewLot(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="lot-details-grid">
              <div><span>Lot ID</span><strong>{viewLot.id}</strong></div>
              <div><span>Material</span><strong>{viewLot.material}</strong></div>
              <div><span>Received date</span><strong>{viewLot.receivedDate}</strong></div>
              <div><span>Expiry date</span><strong>{viewLot.expiryDate}</strong></div>
              <div>
                <span>Initial quantity</span>
                <strong>{viewLot.initialQuantity} {viewLot.unit}</strong>
              </div>
              <div>
                <span>Current quantity</span>
                <strong>{viewLot.currentQuantity} {viewLot.unit}</strong>
              </div>
              <div>
                <span>Storage</span>
                <strong>{viewLot.storage || "Not specified"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{getStatusLabel(viewLot.status)}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setViewLot(null)}
              >
                Close
              </button>
                {isAdmin && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setViewLot(null);
                    openEditModal(viewLot);
                  }}
                >
                  <Pencil size={14} /> Edit lot
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lots;
