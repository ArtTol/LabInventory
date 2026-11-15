
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Download,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Filter,
  ClipboardList,
  X,
} from "lucide-react";
import { api } from "../services/api";
type LotApi = {
  id: number;
  lotNumber: string;
  material: string;
  currentQuantity: number | string;
  unit: string;
  status: string;
};

type MovementType = "Receipt" | "Write-off" | "Adjustment";

type Movement = {
  id: string;
  date: string;
  material: string;
  lotNumber: string;
  type: MovementType;
  quantity: number;
  unit: string;
  reason: string;
  reference: string;
  user: string;
};

type MovementApi = {
  id: number | string;
  movementDate: string;
  movementType: "RECEIPT" | "WRITE_OFF" | "ADJUSTMENT";
  material: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  reason: string | null;
  reference: string | null;
  user: string;
};

const movementTypes = ["All types", "Receipt", "Write-off", "Adjustment"];

function Movements() {
    const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
const [lots, setLots] = useState<LotApi[]>([]);
const [adjustmentLotId, setAdjustmentLotId] = useState("");
const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
const [adjustmentReason, setAdjustmentReason] = useState("");
const [adjustmentReference, setAdjustmentReference] = useState("");
const [adjustmentNotes, setAdjustmentNotes] = useState("");
const [adjustmentError, setAdjustmentError] = useState("");
const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    async function loadMovements() {
      try {
        const movementsData = await api.get<MovementApi[]>("/movements");

        const mappedMovements: Movement[] = movementsData.map((item) => {
          const type: MovementType =
            item.movementType === "RECEIPT"
              ? "Receipt"
              : item.movementType === "WRITE_OFF"
              ? "Write-off"
              : "Adjustment";

          const quantity = Number(item.quantity);

          return {
            id: String(item.id),
            date: item.movementDate,
            material: item.material,
            lotNumber: item.lotNumber,
            type,
           quantity: quantity,
            unit: item.unit,
            reason: item.reason || "—",
            reference: item.reference || "—",
            user: item.user || "—",
          };
        });

        setMovements(mappedMovements);
      } catch (error) {
        console.error("Failed to load movements:", error);
      }
    }

    loadMovements();
  }, []);
    useEffect(() => {
    const query = searchParams.get("search");

    if (query) {
      setSearch(query);
    }
  }, [searchParams]);
  useEffect(() => {
  if (!adjustmentModalOpen) return;

  async function loadLots() {
    try {
      const response = await api.get<LotApi[]>("/lots");
      setLots(response);
    } catch (error) {
      console.error("Failed to load lots:", error);
    }
  }

  loadLots();
}, [adjustmentModalOpen]);


  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const matchesSearch =
        !query ||
        movement.id.toLowerCase().includes(query) ||
        movement.material.toLowerCase().includes(query) ||
        movement.lotNumber.toLowerCase().includes(query) ||
        movement.reference.toLowerCase().includes(query) ||
        movement.user.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "All types" || movement.type === typeFilter;

      const movementDate = movement.date.slice(0, 10);
      const matchesFrom = !dateFrom || movementDate >= dateFrom;
      const matchesTo = !dateTo || movementDate <= dateTo;

      return matchesSearch && matchesType && matchesFrom && matchesTo;
    });
  }, [movements, search, typeFilter, dateFrom, dateTo]);

  const receiptCount = movements.filter(
    (movement) => movement.type === "Receipt"
  ).length;

  const writeOffCount = movements.filter(
    (movement) => movement.type === "Write-off"
  ).length;

  const adjustmentCount = movements.filter(
    (movement) => movement.type === "Adjustment"
  ).length;

  function exportCSV() {
    const headers = [
      "Movement ID",
      "Date",
      "Material",
      "Lot Number",
      "Type",
      "Quantity",
      "Unit",
      "Reason",
      "Reference",
      "User",
    ];

    const rows = filteredMovements.map((movement) => [
      movement.id,
      movement.date,
      movement.material,
      movement.lotNumber,
      movement.type,
      movement.quantity,
      movement.unit,
      movement.reason,
      movement.reference,
      movement.user,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lab-inventory-movements.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function handleAdjustmentSubmit() {
  const lotId = Number(adjustmentLotId);
  const quantity = Number(adjustmentQuantity);

  if (!lotId || !Number.isFinite(quantity) || quantity === 0) {
    setAdjustmentError("Select a lot and enter a non-zero adjustment quantity.");
    return;
  }

  if (!adjustmentReason.trim()) {
    setAdjustmentError("Adjustment reason is required.");
    return;
  }

  try {
    setAdjustmentLoading(true);
    setAdjustmentError("");

    await api.post("/movements/adjustment", {
      lotId,
      quantity,
      reason: adjustmentReason.trim(),
      reference: adjustmentReference.trim(),
      notes: adjustmentNotes.trim(),
    });

    setAdjustmentModalOpen(false);
    setAdjustmentLotId("");
    setAdjustmentQuantity("");
    setAdjustmentReason("");
    setAdjustmentReference("");
    setAdjustmentNotes("");
    setAdjustmentError("");

    const movementsData = await api.get<MovementApi[]>("/movements");

    const mappedMovements: Movement[] = movementsData.map((item) => {
      const type: MovementType =
        item.movementType === "RECEIPT"
          ? "Receipt"
          : item.movementType === "WRITE_OFF"
          ? "Write-off"
          : "Adjustment";

      return {
        id: String(item.id),
        date: item.movementDate,
        material: item.material,
        lotNumber: item.lotNumber,
        type,
        quantity: Number(item.quantity),
        unit: item.unit,
        reason: item.reason || "—",
        reference: item.reference || "—",
        user: item.user || "—",
      };
    });

    setMovements(mappedMovements);
  } catch (error) {
    console.error("Failed to save adjustment:", error);
    setAdjustmentError(
      error instanceof Error ? error.message : "Failed to save adjustment."
    );
  } finally {
    setAdjustmentLoading(false);
  }
}

  function clearFilters() {
    setSearch("");
    setTypeFilter("All types");
    setDateFrom("");
    setDateTo("");
  }

  function formatQuantity(quantity: number, unit: string) {
    const sign = quantity > 0 ? "+" : "";
    return `${sign}${quantity.toLocaleString()} ${unit}`;
  }

  return (
    <div className="movements-page">
      <div className="page-heading">
        <div>
          <h1>Movements</h1>
          <p>Track all material receipts, write-offs and adjustments.</p>
        </div>
<div style={{ display: "flex", gap: "10px" }}>
  <button
    className="primary-button"
    onClick={() => setAdjustmentModalOpen(true)}
  >
    <RefreshCw size={15} />
    Adjust Stock
  </button>

  <button className="secondary-button" onClick={exportCSV}>
    <Download size={15} />
    Export CSV
  </button>
</div>
      </div>

      <div className="movements-summary">
        <div className="movements-summary-card">
          <div className="movements-summary-icon blue">
            <ClipboardList size={19} />
          </div>
          <div>
            <span>Total transactions</span>
            <strong>{movements.length}</strong>
          </div>
        </div>

        <div className="movements-summary-card">
          <div className="movements-summary-icon green">
            <ArrowDownCircle size={19} />
          </div>
          <div>
            <span>Receipts</span>
            <strong>{receiptCount}</strong>
          </div>
        </div>

        <div className="movements-summary-card">
          <div className="movements-summary-icon orange">
            <ArrowUpCircle size={19} />
          </div>
          <div>
            <span>Write-offs</span>
            <strong>{writeOffCount}</strong>
          </div>
        </div>

        <div className="movements-summary-card">
          <div className="movements-summary-icon gray">
            <RefreshCw size={19} />
          </div>
          <div>
            <span>Adjustments</span>
            <strong>{adjustmentCount}</strong>
          </div>
        </div>
      </div>

      <section className="movements-panel">
        <div className="movements-toolbar">
          <div className="movements-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search ID, material, lot, reference or user..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="movements-filter">
            <Filter size={14} />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              {movementTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <label className="movement-date-filter">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label className="movement-date-filter">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>

          <button
            className="movement-clear-button"
            onClick={clearFilters}
            type="button"
          >
            Clear
          </button>
        </div>

        <div className="movements-table-wrapper">
          <table className="data-table movements-table">
            <thead>
              <tr>
                <th>Movement ID</th>
                <th>Date & time</th>
                <th>Material</th>
                <th>Lot number</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Reason</th>
                <th>Reference</th>
                <th>User</th>
              </tr>
            </thead>

            <tbody>
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-table">
                    No movements match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="id-label">{movement.id}</td>
                    <td className="movement-date">
                      {new Date(movement.date).toLocaleString()}
                    </td>
                    <td className="movement-material">
                      {movement.material}
                    </td>
                    <td>{movement.lotNumber}</td>
                    <td>
                      <span
                        className={`movement-type ${movement.type
                          .toLowerCase()
                          .replace("-", "")}`}
                      >
                        {movement.type === "Receipt" && (
                          <ArrowDownCircle size={12} />
                        )}
                        {movement.type === "Write-off" && (
                          <ArrowUpCircle size={12} />
                        )}
                        {movement.type === "Adjustment" && (
                          <RefreshCw size={12} />
                        )}
                        {movement.type}
                      </span>
                    </td>
                    <td
                      className={`movement-quantity ${
                        movement.quantity > 0 ? "positive" : "negative"
                      }`}
                    >
                      {formatQuantity(movement.quantity, movement.unit)}
                    </td>
                    <td>{movement.reason}</td>
                    <td>{movement.reference}</td>
                    <td>{movement.user}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="movements-footer">
          <span>
            Showing {filteredMovements.length} of {movements.length} records
          </span>
          <span>All quantities are recorded in the material's unit.</span>
        </div>
      </section>

      <div className="movements-note">
  <ClipboardList size={17} />
  <p>
    All receipts, write-offs and adjustments are recorded
    automatically with the responsible user and timestamp.
  </p>
</div>
      {adjustmentModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setAdjustmentModalOpen(false)}
        >
          <div
            className="material-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Stock adjustment</h2>
                <p>Correct the current quantity of a material lot.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setAdjustmentModalOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleAdjustmentSubmit();
              }}
            >
              <div className="form-grid">
                <label className="form-field">
                  Lot *
                  <select
                    required
                    value={adjustmentLotId}
                    onChange={(event) =>
                      setAdjustmentLotId(event.target.value)
                    }
                  >
                    <option value="">Select lot</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lotNumber} — {lot.material} (
                        {Number(lot.currentQuantity).toLocaleString()} {lot.unit})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  Adjustment quantity *
                  <input
                    required
                    type="number"
                    step="any"
                    value={adjustmentQuantity}
                    onChange={(event) =>
                      setAdjustmentQuantity(event.target.value)
                    }
                    placeholder="Positive or negative value"
                  />
                </label>

                <label className="form-field">
  Reason *
  <select
    required
    value={adjustmentReason}
    onChange={(event) =>
      setAdjustmentReason(event.target.value)
    }
  >
    <option value="">Select reason</option>
    <option value="Laboratory analysis">Laboratory analysis</option>
    <option value="Quality control">Quality control</option>
    <option value="Research">Research</option>
    <option value="Damaged material">Damaged material</option>
    <option value="Expired material">Expired material</option>
    <option value="Other">Other</option>
  </select>
</label>

                <label className="form-field">
                  Reference
                  <input
                    value={adjustmentReference}
                    onChange={(event) =>
                      setAdjustmentReference(event.target.value)
                    }
                    placeholder="Document or reference number"
                  />
                </label>

                <label className="form-field">
                  Notes
                  <input
                    value={adjustmentNotes}
                    onChange={(event) =>
                      setAdjustmentNotes(event.target.value)
                    }
                    placeholder="Additional information"
                  />
                </label>
              </div>

              <p>
                Positive quantity increases stock. Negative quantity decreases
                stock.
              </p>

              {adjustmentError && (
                <div className="error-message">{adjustmentError}</div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setAdjustmentModalOpen(false)}
                  disabled={adjustmentLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={adjustmentLoading || lots.length === 0}
                >
                  {adjustmentLoading ? "Saving..." : "Save adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Movements;
