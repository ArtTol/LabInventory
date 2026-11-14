
import { Router } from "express";
import { pool } from "../config/database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/lots
router.get("/", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.lot_number AS "lotNumber",
        l.material_id AS "materialId",
        m.name AS material,
       TO_CHAR(l.received_date, 'YYYY-MM-DD') AS "receivedDate",
        TO_CHAR(l.expiry_date, 'YYYY-MM-DD') AS "expiryDate",
        TO_CHAR(COALESCE(l.effective_expiry_date, l.expiry_date), 'YYYY-MM-DD') AS "effectiveExpiryDate",
        l.initial_quantity AS "initialQuantity",
        l.current_quantity AS "currentQuantity",
        m.unit,
        COALESCE(l.storage_conditions, m.storage_conditions) AS storage,
        CASE
          WHEN l.current_quantity = 0 THEN 'DEPLETED'
          WHEN COALESCE(l.effective_expiry_date, l.expiry_date) < CURRENT_DATE THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END AS status
      FROM lots l
      JOIN materials m ON m.id = l.material_id
      ORDER BY l.received_date DESC, l.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get lots error:", error);
    res.status(500).json({ message: "Failed to retrieve lots" });
  }
});

// POST /api/lots

 // POST /api/lots
router.post("/", requireRole("Admin", "Chemist"), async (req, res) => {
  const {
    lotNumber,
    materialId,
    receivedDate,
    expiryDate,
    initialQuantity,
    currentQuantity,
    storage,
    supplier,
    reference,
    notes,
  } = req.body;

  const parsedMaterialId = Number(materialId);
  const initial = Number(initialQuantity);
  const current =
    currentQuantity === undefined || currentQuantity === null
      ? initial
      : Number(currentQuantity);

  if (
    typeof lotNumber !== "string" ||
    !lotNumber.trim() ||
    !Number.isInteger(parsedMaterialId) ||
    parsedMaterialId <= 0 ||
    !receivedDate ||
    !expiryDate ||
    !Number.isFinite(initial) ||
    !Number.isFinite(current) ||
    initial <= 0 ||
    current !== initial
  ) {
    res.status(400).json({ message: "Invalid lot data" });
    return;
  }

  if (new Date(expiryDate) < new Date(receivedDate)) {
    res.status(400).json({
      message: "Expiry date cannot be earlier than received date",
    });
    return;
  }

  if (
    supplier !== undefined &&
    typeof supplier !== "string"
  ) {
    res.status(400).json({ message: "Invalid supplier" });
    return;
  }

  if (
    reference !== undefined &&
    typeof reference !== "string"
  ) {
    res.status(400).json({ message: "Invalid reference" });
    return;
  }

  if (
    notes !== undefined &&
    typeof notes !== "string"
  ) {
    res.status(400).json({ message: "Invalid notes" });
    return;
  }

  const parsedStorage =
    typeof storage === "string" && storage.trim()
      ? storage.trim()
      : null;

  const parsedSupplier = supplier?.trim() || "N/A";
  const parsedReference = reference?.trim() || null;
  const parsedNotes = notes?.trim() || "";

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Verify that the material exists and retrieve its unit.
    const materialResult = await client.query(
      `SELECT id, unit
       FROM materials
       WHERE id = $1 AND is_active = TRUE`,
      [parsedMaterialId]
    );

    if (materialResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(404).json({
        message: "Active material not found",
      });
      return;
    }

    // Create the lot.
    const lotResult = await client.query(
      `INSERT INTO lots (
         lot_number,
         material_id,
         received_date,
         expiry_date,
         effective_expiry_date,
         initial_quantity,
         current_quantity,
         storage_conditions,
         status
       )
       VALUES (
         $1, $2, $3, $4, $4, $5, $5, $6,
         CASE
           WHEN $4 < CURRENT_DATE THEN 'EXPIRED'
           ELSE 'ACTIVE'
         END
       )
       RETURNING id`,
      [
        lotNumber.trim(),
        parsedMaterialId,
        receivedDate,
        expiryDate,
        initial,
        parsedStorage,
      ]
    );

    const lotId = lotResult.rows[0].id;

    // Record the receipt movement.
    const movementResult = await client.query(
      `INSERT INTO movements (
         lot_id,
         movement_type,
         quantity_signed,
         reason,
         user_id,
         reference,
         material_id
       )
       VALUES ($1, 'RECEIPT', $2, $3, $6, $4, $5)
       RETURNING id, movement_datetime`,
      [
  lotId,
  initial,
  "Material receipt",
  parsedReference,
  parsedMaterialId,
  req.session.user?.id ?? null,
]
    );

    const movement = movementResult.rows[0];

    // Record the audit event.
    const auditDetails = [
      `Receipt: ${initial} ${materialResult.rows[0].unit}`,
      `Supplier: ${parsedSupplier}`,
      `Reference: ${parsedReference || "N/A"}`,
      parsedNotes ? `Notes: ${parsedNotes}` : null,
    ]
      .filter(Boolean)
      .join("; ");

        await client.query(
      `INSERT INTO audit_trail (
         user_id,
         username,
         action,
         entity_type,
         record_id,
         field_name,
         old_value,
         new_value,
         details
       )
       VALUES (
         $1,
         $2,
         'RECEIPT',
         'LOT',
         $3,
         'current_quantity',
         '0',
         $4,
         $5
       )`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        String(lotId),
        String(initial),
        auditDetails,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({
      message: "Receipt completed successfully",
      lotId,
      movementId: movement.id,
      movementDate: movement.movement_datetime,
      quantity: initial,
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Create receipt error:", error);
    res.status(500).json({
      message: "Failed to complete receipt",
    });
  } finally {
    client.release();
  }
});



// PUT /api/lots/:id
router.put("/:id", requireRole("Admin"), async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const {
      lotNumber,
      materialId,
      receivedDate,
      expiryDate,
      storage,
    } = req.body;

    if (
      !lotNumber?.trim() ||
      !Number.isInteger(Number(materialId)) ||
      !receivedDate ||
      !expiryDate
    ) {
      res.status(400).json({ message: "Invalid lot data" });
      return;
    }

    if (expiryDate < receivedDate) {
      res.status(400).json({
        message: "Expiry date cannot be earlier than received date",
      });
      return;
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const existingResult = await client.query(
      `SELECT
  lot_number,
  material_id,
  received_date::text AS received_date,
  expiry_date::text AS expiry_date,
  storage_conditions
FROM lots
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(404).json({ message: "Lot not found" });
      return;
    }

    const existing = existingResult.rows[0];

    const newLotNumber = lotNumber.trim();
    const newMaterialId = Number(materialId);
    const newStorage = storage || null;

    const result = await client.query(
      `UPDATE lots SET
        lot_number = $1,
        material_id = $2,
        received_date = $3,
        expiry_date = $4,
        effective_expiry_date = $4,
        storage_conditions = $5,
        status = CASE
          WHEN current_quantity = 0 THEN 'DEPLETED'
          WHEN $4 < CURRENT_DATE THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END,
        updated_at = NOW()
      WHERE id = $6
      RETURNING id`,
      [
        newLotNumber,
        newMaterialId,
        receivedDate,
        expiryDate,
        newStorage,
        req.params.id,
      ]
    );

    const auditChanges = [
      {
        fieldName: "lot_number",
        oldValue: existing.lot_number,
        newValue: newLotNumber,
      },
      {
        fieldName: "material_id",
        oldValue: String(existing.material_id),
        newValue: String(newMaterialId),
      },
      {
        fieldName: "received_date",
        oldValue: String(existing.received_date).slice(0, 10),
        newValue: receivedDate,
      },
      {
        fieldName: "expiry_date",
        oldValue: String(existing.expiry_date).slice(0, 10),
        newValue: expiryDate,
      },
      {
        fieldName: "storage_conditions",
        oldValue: existing.storage_conditions ?? null,
        newValue: newStorage,
      },
    ].filter(
      (change) =>
        String(change.oldValue ?? "") !==
        String(change.newValue ?? "")
    );

    for (const change of auditChanges) {
      await client.query(
        `INSERT INTO audit_trail (
          user_id,
          username,
          action,
          entity_type,
          record_id,
          field_name,
          old_value,
          new_value,
          details
        )
        VALUES ($1, $2, 'UPDATE', 'LOT', $3, $4, $5, $6, $7)`,
        [
          req.session.user?.id ?? null,
          req.session.user?.username ?? null,
          String(result.rows[0].id),
          change.fieldName,
          change.oldValue === null ? null : String(change.oldValue),
          change.newValue === null ? null : String(change.newValue),
          `Lot updated: ${change.fieldName}`,
        ]
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({ message: "Lot updated successfully" });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Update lot error:", error);
    res.status(500).json({ message: "Failed to update lot" });
  } finally {
    client.release();
  }
});
export default router;
