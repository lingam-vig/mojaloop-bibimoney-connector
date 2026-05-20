// harness.js
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

// --- ILP helper ---
function generateIlpPair() {
  const fulfilmentBuf = crypto.randomBytes(32);
  const conditionBuf = crypto
    .createHash("sha256")
    .update(fulfilmentBuf)
    .digest();

  return {
    fulfilment: fulfilmentBuf.toString("base64"),
    condition: conditionBuf.toString("base64")
  };
}

// --- Simple in‑memory store so condition/fulfilment match ---
const transfers = new Map();

// --- Health ---
app.get("/", (_req, res) => res.status(200).json({ status: "ok" }));

// --- Party lookup (GET /parties/{idType}/{idValue}) ---
app.get("/parties/:idType/:idValue", (req, res) => {
  console.log("[HARNESS] GET /parties", req.params);

  res.status(200).json({
    partyIdInfo: {
      partyIdType: req.params.idType,
      partyIdentifier: req.params.idValue,
      fspId: "payee-dfsp"
    },
    name: "Test Payee",
    personalInfo: {
      complexName: {
        firstName: "Test",
        lastName: "Payee"
      }
    }
  });
});

// --- Quote simulation (POST /quotes) ---
app.post("/quotes", (req, res) => {
  console.log("[HARNESS] POST /quotes");
  console.log(JSON.stringify(req.body, null, 2));

  const quoteId       = crypto.randomUUID();
  const transactionId = req.body.transactionId || crypto.randomUUID();
  const { condition } = generateIlpPair(); // could store per quote if you want

  const expiration = new Date(Date.now() + 60_000).toISOString();

  const body = {
    quoteId,
    transactionId,
    transferAmount: {
      amount: req.body.amount.amount,
      currency: req.body.amount.currency
    },
    payeeReceiveAmount: {
      amount: req.body.amount.amount,
      currency: req.body.amount.currency
    },
    payeeFspFee: {
      amount: "2.00",
      currency: req.body.amount.currency
    },
    payeeFspCommission: {
      amount: "0",
      currency: req.body.amount.currency
    },
    condition,
    expiration
  };

  res.status(200).json(body);
});

// --- Transfer prepare (POST /transfers) ---
app.post("/transfers", (req, res) => {
  console.log("[HARNESS] POST /transfers");
  console.log(JSON.stringify(req.body, null, 2));

  const transferId = req.body.transferId || crypto.randomUUID();
  const { fulfilment, condition } = generateIlpPair();
  const expiration = new Date(Date.now() + 60_000).toISOString();

  transfers.set(transferId, { fulfilment, condition });

  const body = {
    transferId,
    transferState: "RESERVED",
    completedTimestamp: null,
    ilpCondition: condition,
    expiration
  };

  res.status(200).json(body);
});

// --- Transfer fulfilment (PUT /transfers/{id}) ---
app.put("/transfers/:transferId", (req, res) => {
  const { transferId } = req.params;
  console.log("[HARNESS] PUT /transfers/" + transferId);
  console.log(JSON.stringify(req.body, null, 2));

  const stored = transfers.get(transferId);
  if (!stored) {
    return res.status(404).json({
      errorInformation: {
        errorCode: "3204",
        errorDescription: "Unknown transferId"
      }
    });
  }

  const body = {
    transferId,
    transferState: "COMMITTED",
    completedTimestamp: new Date().toISOString(),
    fulfilment: stored.fulfilment
  };

  res.status(200).json(body);
});

// --- Error callback (optional, for negative tests) ---
app.put("/transfers/:transferId/error", (req, res) => {
  console.log("[HARNESS] PUT /transfers/" + req.params.transferId + "/error");
  console.log(JSON.stringify(req.body, null, 2));

  res.status(200).json({ status: "error-acknowledged" });
});

app.listen(4001, () =>
  console.log("[HARNESS] Mojaloop-style harness on http://localhost:4001")
);
