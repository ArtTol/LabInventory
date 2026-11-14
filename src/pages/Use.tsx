
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ClipboardList,
  Package,
  AlertCircle,
  CheckCircle2,
  ArrowDownCircle,
  CalendarDays,
} from "lucide-react";
import { api } from "../services/api";

type MaterialApi = {
  id: number | string;
  name: string;
  unit: string;
  isActive: boolean;
};

type LotApi = {
  id: number | string;
  lotNumber: string;
  materialId: number | string;
  material: string;
  expiryDate: string;
  receivedDate: string;
  currentQuantity: number | string;
  unit: string;
  status: string;
};
type MovementApi = {
  id: number | string;
  movementDate: string;
  movementType: "RECEIPT" | "WRITE_OFF" | "ADJUSTMENT";
  material: string;
  lotNumber: string;
  quantity: number | string;
  unit: string;
  reason: string | null;
  reference: string | null;

};

type Lot = {
  id: string;
  lotNumber: string;
  materialId: string;
  material: string;
  expiryDate: string;
  receivedDate: string;
  quantity: number;
  unit: string;
};

type Material = {
  id: string;
  name: string;
  unit: string;
};

type WriteOff = {
  id: string;
  date: string;
  material: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  reason: string;
  reference: string;
};

type WriteOffResponse = {
  message: string;
  movementId: number;
  movementDate: string;
  lotId: number;
  oldQuantity: number;
  writtenOff: number;
  newQuantity: number;
};

const reasons = [
  "Laboratory analysis",
  "Quality control",
  "Research",
  "Damaged material",
  "Expired material",
  "Other",
];

function todayString() {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 10);
}

function Use() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [lotId, setLotId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Laboratory analysis");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = todayString();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [materialsData, lotsData, movementsData] = await Promise.all([
  api.get<MaterialApi[]>("/materials"),
  api.get<LotApi[]>("/lots"),
  api.get<MovementApi[]>("/movements"),
]);
        

        const mappedMaterials = materialsData
          .filter((item) => item.isActive)
          .map((item) => ({
            id: String(item.id),
            name: item.name,
            unit: item.unit,
          }));

        const mappedLots = lotsData.map((item) => ({
          id: String(item.id),
          lotNumber: item.lotNumber,
          materialId: String(item.materialId),
          material: item.material,
          expiryDate: item.expiryDate,
          receivedDate: item.receivedDate,
          quantity: Number(item.currentQuantity),
          unit: item.unit,
        }));

        setMaterials(mappedMaterials);
        setLots(mappedLots);
        setWriteOffs(
  movementsData
    .filter((item) => item.movementType === "WRITE_OFF")
    .map((item) => ({
      id: String(item.id),
      date: new Date(item.movementDate).toLocaleString(),
      material: item.material,
      lotNumber: item.lotNumber,
      quantity: Number(item.quantity),
      unit: item.unit,
      reason: item.reason || "—",
      reference: item.reference || "—",
    }))
);

        if (mappedMaterials.length > 0) {
          setMaterialId(mappedMaterials[0].id);
        }
      } catch (err) {
        console.error("Load write-off data error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load materials and lots."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedMaterial = materials.find(
    (material) => material.id === materialId
  );

  const availableLots = useMemo(() => {
    return lots
      .filter(
        (lot) =>
          lot.materialId === materialId &&
          lot.quantity > 0 &&
          lot.expiryDate >= today
      )
      .sort((a, b) => {
        const expiryComparison = a.expiryDate.localeCompare(b.expiryDate);
        if (expiryComparison !== 0) return expiryComparison;
        return a.receivedDate.localeCompare(b.receivedDate);
      });
  }, [lots, materialId, today]);

  const selectedLot = availableLots.find((lot) => lot.id === lotId);

  const totalAvailable = availableLots.reduce(
    (sum, lot) => sum + lot.quantity,
    0
  );

  function handleMaterialChange(value: string) {
    setMaterialId(value);
    setLotId("");
    setQuantity("");
    setError("");
    setSuccess("");
  }

  function handleLotChange(value: string) {
    setLotId(value);
    setQuantity("");
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amount = Number(quantity);

    if (!selectedMaterial) {
      setError("Please select a material.");
      return;
    }

    if (!selectedLot) {
      setError("Please select an available lot.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    if (amount > selectedLot.quantity) {
      setError(
        `Insufficient quantity. Available: ${selectedLot.quantity} ${selectedLot.unit}.`
      );
      return;
    }

    try {
      setSubmitting(true);

      const result = await api.post<WriteOffResponse>(
        "/movements/write-off",
        {
          lotId: Number(selectedLot.id),
          quantity: amount,
          reason,
          reference: reference.trim(),
          notes: notes.trim(),
        }
      );

      setLots((previous) =>
        previous.map((lot) =>
          lot.id === String(result.lotId)
            ? { ...lot, quantity: Number(result.newQuantity) }
            : lot
        )
      );

      const newWriteOff: WriteOff = {
        id: String(result.movementId),
        date: new Date(result.movementDate).toLocaleString(),
        material: selectedLot.material,
        lotNumber: selectedLot.lotNumber,
        quantity: amount,
        unit: selectedLot.unit,
        reason,
        reference: reference.trim() || "—",
      };

      setWriteOffs((previous) => [newWriteOff, ...previous]);
      setQuantity("");
      setReference("");
      setNotes("");
      setLotId("");

      setSuccess(
        `${amount} ${selectedLot.unit} of ${selectedLot.material} successfully written off.`
      );
    } catch (err) {
      console.error("Write-off error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete write-off."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setMaterialId(materials[0]?.id || "");
    setLotId("");
    setQuantity("");
    setReason("Laboratory analysis");
    setReference("");
    setNotes("");
    setError("");
    setSuccess("");
  }

  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString();

  return (
    <div className="use-page">
      <div className="page-heading">
        <div>
          <h1>Write-off</h1>
          <p>Record material consumption and inventory write-offs.</p>
        </div>
      </div>

      <div className="use-summary">
        <div className="use-summary-card">
          <div className="use-summary-icon blue">
            <Package size={19} />
          </div>
          <div>
            <span>Available lots</span>
            <strong>{availableLots.length}</strong>
          </div>
        </div>

        <div className="use-summary-card">
          <div className="use-summary-icon green">
            <CheckCircle2 size={19} />
          </div>
          <div>
            <span>Available quantity</span>
            <strong>
              {totalAvailable.toLocaleString()} {selectedMaterial?.unit || ""}
            </strong>
          </div>
        </div>

        <div className="use-summary-card">
          <div className="use-summary-icon orange">
            <ClipboardList size={19} />
          </div>
          <div>
            <span>Recorded write-offs</span>
            <strong>{writeOffs.length}</strong>
          </div>
        </div>
      </div>

      {loading && (
        <div className="use-message">
          Loading materials and lots...
        </div>
      )}

      <div className="use-layout">
        <section className="use-form-panel">
          <div className="use-panel-heading">
            <div className="use-heading-icon">
              <ArrowDownCircle size={19} />
            </div>
            <div>
              <h2>New write-off</h2>
              <p>Enter the details of material consumption.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="use-form-section">
              <h3>Material information</h3>

              <div className="use-form-grid">
                <label className="use-field full">
                  <span>Material *</span>
                  <select
                    value={materialId}
                    onChange={(event) =>
                      handleMaterialChange(event.target.value)
                    }
                    disabled={loading || submitting || materials.length === 0}
                  >
                    {materials.length === 0 && (
                      <option value="">No active materials</option>
                    )}
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="use-field full">
                  <span>Batch / Lot *</span>
                  <select
                    value={lotId}
                    onChange={(event) => handleLotChange(event.target.value)}
                    required
                    disabled={loading || submitting || availableLots.length === 0}
                  >
                    <option value="">Select a lot</option>
                    {availableLots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lotNumber} — {lot.quantity.toLocaleString()}{" "}
                        {lot.unit} — Exp: {formatDate(lot.expiryDate)}
                      </option>
                    ))}
                  </select>
                  <small>
                    Lots are sorted by FEFO: earliest expiry date first.
                  </small>
                </label>

                {selectedLot && (
                  <div className="use-lot-info full">
                    <div>
                      <span>Available quantity</span>
                      <strong>
                        {selectedLot.quantity.toLocaleString()}{" "}
                        {selectedLot.unit}
                      </strong>
                    </div>
                    <div>
                      <span>Expiry date</span>
                      <strong>{formatDate(selectedLot.expiryDate)}</strong>
                    </div>
                    <div>
                      <span>Lot number</span>
                      <strong>{selectedLot.lotNumber}</strong>
                    </div>
                  </div>
                )}

                <label className="use-field">
                  <span>Quantity to write off *</span>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    max={selectedLot?.quantity}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Enter quantity"
                    required
                    disabled={!selectedLot || submitting}
                  />
                </label>

                <label className="use-field">
                  <span>Unit</span>
                  <input
                    value={selectedLot?.unit || selectedMaterial?.unit || ""}
                    readOnly
                  />
                </label>
              </div>
            </div>

            <div className="use-form-section">
              <h3>Write-off details</h3>

              <div className="use-form-grid">
                <label className="use-field">
                  <span>Reason *</span>
                  <select
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    disabled={submitting}
                  >
                    {reasons.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="use-field">
                  <span>Document reference</span>
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="e.g. LAB-2026-001"
                    disabled={submitting}
                  />
                </label>

                <label className="use-field full">
                  <span>Notes</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Additional information..."
                    rows={3}
                    disabled={submitting}
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="use-message error">
                <AlertCircle size={17} />
                {error}
              </div>
            )}

            {success && (
              <div className="use-message success">
                <CheckCircle2 size={17} />
                {success}
              </div>
            )}

            <div className="use-form-actions">
              <button
                type="button"
                className="use-reset-button"
                onClick={resetForm}
                disabled={submitting}
              >
                Clear form
              </button>
              <button
                type="submit"
                className="use-submit-button"
                disabled={loading || submitting || !selectedLot}
              >
                <ArrowDownCircle size={16} />
                {submitting ? "Processing..." : "Confirm write-off"}
              </button>
            </div>
          </form>
        </section>

        <aside className="use-side-panel">
          <div className="use-info-card">
            <div className="use-info-heading">
              <CalendarDays size={18} />
              <h3>FEFO principle</h3>
            </div>
            <p>
              First Expired, First Out. The system sorts available lots by
              expiry date, prioritizing the batch that expires first.
            </p>
            <div className="use-fefo-example">
              {availableLots.slice(0, 3).map((lot, index) => (
                <div className="use-fefo-row" key={lot.id}>
                  <span className="use-fefo-number">{index + 1}</span>
                  <div>
                    <strong>{lot.lotNumber}</strong>
                    <small>Expires {formatDate(lot.expiryDate)}</small>
                  </div>
                  {index === 0 && <span className="use-first-badge">First</span>}
                </div>
              ))}
              {availableLots.length === 0 && (
                <p className="use-no-lots">
                  No available lots for this material.
                </p>
              )}
            </div>
          </div>

          <div className="use-warning-card">
            <AlertCircle size={18} />
            <div>
              <strong>Before confirming</strong>
              <p>
                Verify the selected lot and quantity. A write-off reduces the
                available balance of that lot.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section className="use-history-panel">
        <div className="use-history-heading">
          <div>
            <h2>Recent write-offs</h2>
            <p>Write-off records created in this session.</p>
          </div>
          <span>{writeOffs.length} records</span>
        </div>

        <div className="table-responsive">
          <table className="data-table use-history-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Date</th>
                <th>Material</th>
                <th>Lot number</th>
                <th>Quantity</th>
                <th>Reason</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {writeOffs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table">
                    No write-off records yet.
                  </td>
                </tr>
              ) : (
                writeOffs.map((item) => (
                  <tr key={item.id}>
                    <td className="id-label">{item.id}</td>
                    <td>{item.date}</td>
                    <td>{item.material}</td>
                    <td>{item.lotNumber}</td>
                    <td className="use-quantity-cell">
                      -{item.quantity.toLocaleString()} {item.unit}
                    </td>
                    <td>{item.reason}</td>
                    <td>{item.reference}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Use;
