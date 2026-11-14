
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  Filter,
  FlaskConical,
  Package,
  AlertTriangle,
  RefreshCw,
  X,
} from "lucide-react";
import { api } from "../services/api";

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
  minStock: number | string;
  isActive: boolean;
};

type StockItem = {
  id: number;
  name: string;
  unit: string;
    isActive: boolean;
  minStock: number;
  quantity: number;
  lotCount: number;
  expiredLots: number;
  status: "in-stock" | "low-stock" | "out-stock";
};

function Stock() {
  const [lots, setLots] = useState<LotApi[]>([]);
  const [materials, setMaterials] = useState<MaterialApi[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [lotsResult, materialsResult] = await Promise.all([
        api.get<LotApi[]>("/lots"),
        api.get<MaterialApi[]>("/materials"),
      ]);

      setLots(lotsResult);
      setMaterials(materialsResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load stock data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const stockItems = useMemo<StockItem[]>(() => {
    return materials.map((material) => {
      const materialLots = lots.filter(
        (lot) => Number(lot.materialId) === Number(material.id)
      );

      // Expired material is excluded from usable stock.
      const usableLots = materialLots.filter(
        (lot) =>
          lot.status.toUpperCase() !== "EXPIRED" &&
          lot.status.toUpperCase() !== "DEPLETED"
      );

      const quantity = usableLots.reduce(
        (sum, lot) => sum + Number(lot.currentQuantity || 0),
        0
      );

      const expiredLots = materialLots.filter(
        (lot) =>
          lot.status.toUpperCase() === "EXPIRED" &&
          Number(lot.currentQuantity) > 0
      ).length;

      const minStock = Number(material.minStock || 0);

      let status: StockItem["status"] = "in-stock";

      if (quantity <= 0) {
        status = "out-stock";
      } else if (quantity <= minStock) {
        status = "low-stock";
      }

      return {
        id: material.id,
        name: material.name,
        unit: material.unit,
        isActive: material.isActive,
        minStock,
        quantity,
        lotCount: materialLots.length,
        expiredLots,
        status,
      };
    });
  }, [materials, lots]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return stockItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(term) ||
        String(item.id).includes(term);

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [stockItems, search, statusFilter]);

  const totalMaterials = stockItems.length;

  const materialsInStock = stockItems.filter(
  (item) => item.quantity > 0
).length;

  const lowStockCount = stockItems.filter(
    (item) => item.status === "low-stock"
  ).length;

  const outStockCount = stockItems.filter(
    (item) => item.status === "out-stock"
  ).length;

  const totalExpiredLots = stockItems.reduce(
    (sum, item) => sum + item.expiredLots,
    0
  );

  function getStatusLabel(status: StockItem["status"]) {
    if (status === "low-stock") return "Low Stock";
    if (status === "out-stock") return "Out of Stock";
    return "In Stock";
  }

  function getProgress(item: StockItem) {
    if (item.quantity <= 0) return 0;
    if (item.minStock <= 0) return 100;

    return Math.min(
      100,
      Math.round((item.quantity / item.minStock) * 100)
    );
  }

  function exportCSV() {
    const header = [
      "Material ID",
      "Material",
      "Quantity",
      "Unit",
      "Minimum Stock",
      "Lots",
      "Expired Lots",
      "Status",
    ];

    const rows = filteredItems.map((item) => [
      item.id,
      item.name,
      item.quantity,
      item.unit,
      item.minStock,
      item.lotCount,
      item.expiredLots,
      getStatusLabel(item.status),
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stock.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stock-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">INVENTORY MANAGEMENT</div>
          <h1>Stock</h1>
          <p>Monitor current inventory levels and material availability.</p>
        </div>

        <button
          className="secondary-button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="stock-summary">
        <div className="stock-summary-card">
          <div className="stock-summary-icon blue">
            <FlaskConical size={19} />
          </div>
          <div>
            <span>Total Materials</span>
            <strong>{totalMaterials}</strong>
          </div>
        </div>

        <div className="stock-summary-card">
          <div className="stock-summary-icon gray">
            <Package size={19} />
          </div>
          <div>
            <span>Materials in Stock</span>
            <strong>{materialsInStock}</strong>
          </div>
        </div>

        <div className="stock-summary-card">
          <div className="stock-summary-icon orange">
            <AlertTriangle size={19} />
          </div>
          <div>
            <span>Low Stock</span>
            <strong>{lowStockCount}</strong>
          </div>
        </div>

        <div className="stock-summary-card">
          <div className="stock-summary-icon red">
            <AlertTriangle size={19} />
          </div>
          <div>
            <span>Out of Stock</span>
            <strong>{outStockCount}</strong>
          </div>
        </div>
      </div>

      <section className="panel stock-panel">
        <div className="stock-toolbar">
          <div className="stock-search">
            <Search size={17} />
            <input
              placeholder="Search materials by name or ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="filter-control">
            <Filter size={15} />
            <select
              className="stock-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-stock">Out of Stock</option>
            </select>
          </div>

          <button className="secondary-button" onClick={exportCSV}>
            <Download size={16} />
            Export
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table stock-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Available Balance</th>
                <th>Unit</th>
                <th>Min. Stock</th>
                <th>Lots</th>
                <th>Expired Lots</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty-table">
                    Loading stock data...
                  </td>
                </tr>
              ) : (
                <>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="stock-material-cell">
                          <div className="stock-material-icon">
                            <FlaskConical size={16} />
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                            {!item.isActive && <span>Inactive</span>}
                            <span>Material ID: #{item.id}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="stock-balance">
                          <strong>
                            {item.quantity.toLocaleString("en-US")}
                          </strong>
                          <div className="stock-progress">
                            <div
                              className={`stock-progress-fill ${
                                item.status === "low-stock"
                                  ? "low"
                                  : item.status === "out-stock"
                                    ? "empty"
                                    : ""
                              }`}
                              style={{ width: `${getProgress(item)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>{item.unit}</td>

                      <td>
                        {item.minStock.toLocaleString("en-US")}
                      </td>

                      <td>
                        <span className="normal-count">
                          {item.lotCount}
                        </span>
                      </td>

                      <td>
                        {item.expiredLots > 0 ? (
                          <span className="expired-count">
                            {item.expiredLots}
                          </span>
                        ) : (
                          <span className="normal-count">0</span>
                        )}
                      </td>

                      <td>
                        <span className={`stock-status ${item.status}`}>
                          <span />
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-table">
                        No materials found. Try changing your search or filters.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing <strong>{filteredItems.length}</strong> of{" "}
            <strong>{stockItems.length}</strong> materials
          </span>
          <span>Connected to PostgreSQL</span>
        </div>
      </section>

      <div className="stock-note">
        <AlertTriangle size={17} />
        <span>
          Available balance excludes expired and depleted lots.
          {totalExpiredLots > 0 &&
            ` There are ${totalExpiredLots} expired lots with remaining quantity.`}
          {" "}Stock levels are calculated from registered lots and compared
          with each material's minimum stock threshold.
        </span>
      </div>
    </div>
  );
}

export default Stock;
