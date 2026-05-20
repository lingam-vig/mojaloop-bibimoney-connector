Run Webserver

npm run start:dev
npx ts-node src/mock/mock-sdk.ts
npx ts-node src/mock/mock-cbs.ts


# ── FLOW 1: Inbound party lookup (SDK → CC → CBS) ──────────────────
# Simulates Mojaloop switch asking: "who owns this MSISDN?"
curl -X GET http://localhost:3003/parties/MSISDN/0771234567
# Verify: [MOCK CBS] POST /account/lookup appears in CBS logs

# ── FLOW 2: Inbound quote (SDK → CC → CBS) ─────────────────────────
curl -X POST http://localhost:3003/quoterequests \
  -H "Content-Type: application/json" \
  -d '{
    "quoteId": "11111111-1111-1111-1111-111111111111",
    "transactionId": "22222222-2222-2222-2222-222222222222",
    "amountType": "SEND",
    "amount": "100",
    "currency": "GMD",
    "transactionType": "TRANSFER",
    "initiator": "PAYER",
    "initiatorType": "CONSUMER",
    "from": { "idType": "MSISDN", "idValue": "0771234567" },
    "to":   { "idType": "MSISDN", "idValue": "0991234567" }
  }'
# Verify: [MOCK CBS] POST /transaction/lookup appears in CBS logs

# ── FLOW 3: Inbound transfer (SDK → CC → CBS) ──────────────────────
curl -X POST http://localhost:3003/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "transferId": "33333333-3333-3333-3333-333333333333",
    "amountType": "SEND",
    "amount": "100",
    "currency": "GMD",
    "transactionType": "TRANSFER",
    "from": { "idType": "MSISDN", "idValue": "0771234567", "fspId": "payee-dfsp" },
    "to":   { "idType": "MSISDN", "idValue": "0991234567", "fspId": "bluebank" },
    "quote": {
      "quoteId": "11111111-1111-1111-1111-111111111111",
      "transactionId": "22222222-2222-2222-2222-222222222222",
      "transferAmount": "100",
      "transferAmountCurrency": "GMD",
      "payeeReceiveAmount": "100",
      "payeeReceiveAmountCurrency": "GMD",
      "payeeFspFeeAmount": "2.00",
      "payeeFspFeeAmountCurrency": "GMD",
      "payeeFspCommissionAmount": "0",
      "payeeFspCommissionAmountCurrency": "GMD"
    },
    "ilpPacket": { "data": {} }
  }'
# Verify: [MOCK CBS] POST /transaction/athorise appears in CBS logs

# ── FLOW 4: Commit (SDK PATCH → CC → CBS) ──────────────────────────
curl -X PATCH http://localhost:3003/transfers/33333333-3333-3333-3333-333333333333 \
  -H "Content-Type: application/json" \
  -d '{
    "currentState": "COMPLETED",
    "transferState": "COMMITTED",
    "homeTransactionId": "some-home-tx-id"
  }'
# Verify: [MOCK CBS] POST /transaction/capture appears in CBS logs

# ── FLOW 5: Outbound send money (CBS → CC → SDK → Switch) ──────────
curl -X POST http://localhost:3004/send-money \
  -H "Content-Type: application/json" \
  -d '{
    "homeTransactionId": "HTX123",
    "payeeId": "0991234567",
    "payeeIdType": "MSISDN",
    "sendAmount": "100",
    "sendCurrency": "GMD",
    "transactionType": "TRANSFER",
    "payer": { "name": "John Doe", "payerId": "0771234567" }
  }'
# Grab transactionId from response then:
curl -X PUT http://localhost:3004/send-money/{transactionId} \
  -H "Content-Type: application/json" \
  -d '{ "acceptQuote": true, "homeTransactionId": "HTX123" }'
# Verify: CBS logs show /transaction/athorise then /transaction/capture

# ── FLOW 6: Abort/unreserve ─────────────────────────────────────────
curl -X PUT http://localhost:3004/send-money/{transactionId} \
  -H "Content-Type: application/json" \
  -d '{ "acceptQuote": false, "homeTransactionId": "HTX123" }'
# Verify: [MOCK CBS] POST /transaction/cancel appears in CBS logs






PS C:\work\projects\coreconnector\sutura-money> npx ts-node src/mock/mock-sdk.ts

 grep -r "payeeReceiveAmount" node_modules/@mojaloop/core-connector-lib/dist/


##=============================== THIS IS THE FLOW ===========================

PORT 3003 — SDK-facing (SDK calls YOUR connector)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Switch/SDK → GET  /parties/MSISDN/{id}     → your CC → CBS /account/lookup
Switch/SDK → POST /quoterequests           → your CC → CBS /transaction/lookup  
Switch/SDK → POST /transfers               → your CC → CBS /transaction/athorise
Switch/SDK → PATCH /transfers/{id}         → your CC → CBS /transaction/capture

PORT 3004 — DFSP-facing (YOUR CBS/App calls connector)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your CBS  → POST /send-money               → your CC → SDK → Switch
Your CBS  → PUT  /send-money/{transferId}  → your CC → SDK → Switch
Your CBS  → POST /merchant-payment         → your CC → SDK → Switch



# ── YOU call port 3004 (outbound — your CBS initiating payment) ──
curl -X POST http://localhost:3004/send-money ...

# ── The SWITCH calls port 3003 (inbound — switch asking about your customer) ──
# You simulate the switch by calling it yourself in tests:
curl -X GET  http://localhost:3003/parties/MSISDN/0771234567
curl -X POST http://localhost:3003/quoterequests ...
curl -X POST http://localhost:3003/transfers ...
curl -X PATCH http://localhost:3003/transfers/{id} ...


 ======================= SEND MONRY==================================
{
      "homeTransactionId": "HTX123",
    "payeeId": "0991234567",
    "payeeIdType": "MSISDN",
    "sendAmount": "100",
    "sendCurrency": "GMD",
    "transactionType": "TRANSFER",
    "payer": { "name": "John Doe", "payerId": "0771234567" }
   }


 {
    "payeeDetails": {
        "idType": "MSISDN",
        "idValue": "0991234567",
        "fspId": "payee-dfsp",
        "name": "",
        "fspLEI": "1234567890ABCDEFGHIJK"
    },
    "sendAmount": "100",
    "sendCurrency": "GMD",
    "receiveAmount": "100",
    "receiveCurrency": "GMD",
    "targetFees": "2",
    "sourceFees": "0",
    "transactionId": "e80e6b3f-db3e-4233-999a-e4856ccab4a1",
    "homeTransactionId": "HTX123"
}


//====================================================================
# ── FLOW 1: Inbound party lookup (SDK → CC → CBS) ──────────────────
# Simulates Mojaloop switch asking: "who owns this MSISDN?"
curl -X GET http://localhost:3003/parties/MSISDN/0771234567
# Verify: [MOCK CBS] POST /account/lookup appears in CBS logs

# ── FLOW 2: Inbound quote (SDK → CC → CBS) ─────────────────────────
curl -X POST http://localhost:3003/quoterequests \
  -H "Content-Type: application/json" \
  -d '{
    "quoteId": "11111111-1111-1111-1111-111111111111",
    "transactionId": "22222222-2222-2222-2222-222222222222",
    "amountType": "SEND",
    "amount": "100",
    "currency": "GMD",
    "transactionType": "TRANSFER",
    "initiator": "PAYER",
    "initiatorType": "CONSUMER",
    "from": { "idType": "MSISDN", "idValue": "0771234567" },
    "to":   { "idType": "MSISDN", "idValue": "0991234567" }
  }'
# Verify: [MOCK CBS] POST /transaction/lookup appears in CBS logs

# ── FLOW 3: Inbound transfer (SDK → CC → CBS) ──────────────────────
curl -X POST http://localhost:3003/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "transferId": "33333333-3333-3333-3333-333333333333",
    "amountType": "SEND",
    "amount": "100",
    "currency": "GMD",
    "transactionType": "TRANSFER",
    "from": { "idType": "MSISDN", "idValue": "0771234567", "fspId": "payee-dfsp" },
    "to":   { "idType": "MSISDN", "idValue": "0991234567", "fspId": "bluebank" },
    "quote": {
      "quoteId": "11111111-1111-1111-1111-111111111111",
      "transactionId": "22222222-2222-2222-2222-222222222222",
      "transferAmount": "100",
      "transferAmountCurrency": "GMD",
      "payeeReceiveAmount": "100",
      "payeeReceiveAmountCurrency": "GMD",
      "payeeFspFeeAmount": "2.00",
      "payeeFspFeeAmountCurrency": "GMD",
      "payeeFspCommissionAmount": "0",
      "payeeFspCommissionAmountCurrency": "GMD"
    },
    "ilpPacket": { "data": {} }
  }'
# Verify: [MOCK CBS] POST /transaction/athorise appears in CBS logs

# ── FLOW 4: Commit (SDK PATCH → CC → CBS) ──────────────────────────
curl -X PATCH http://localhost:3003/transfers/33333333-3333-3333-3333-333333333333 \
  -H "Content-Type: application/json" \
  -d '{
    "currentState": "COMPLETED",
    "transferState": "COMMITTED",
    "homeTransactionId": "some-home-tx-id"
  }'
# Verify: [MOCK CBS] POST /transaction/capture appears in CBS logs

# ── FLOW 5: Outbound send money (CBS → CC → SDK → Switch) ──────────
curl -X POST http://localhost:3004/send-money \
  -H "Content-Type: application/json" \
  -d '{
    "homeTransactionId": "HTX123",
    "payeeId": "0991234567",
    "payeeIdType": "MSISDN",
    "sendAmount": "100",
    "sendCurrency": "GMD",
    "transactionType": "TRANSFER",
    "payer": { "name": "John Doe", "payerId": "0771234567" }
  }'
# Grab transactionId from response then:
curl -X PUT http://localhost:3004/send-money/{transactionId} \
  -H "Content-Type: application/json" \
  -d '{ "acceptQuote": true, "homeTransactionId": "HTX123" }'
# Verify: CBS logs show /transaction/athorise then /transaction/capture

# ── FLOW 6: Abort/unreserve ─────────────────────────────────────────
curl -X PUT http://localhost:3004/send-money/{transactionId} \
  -H "Content-Type: application/json" \
  -d '{ "acceptQuote": false, "homeTransactionId": "HTX123" }'
# Verify: [MOCK CBS] POST /transaction/cancel appears in CBS logs