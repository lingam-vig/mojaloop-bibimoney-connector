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

//////////////////////
{
       "homeTransactionId": "HTX1234",
       "payeeId": "1234567890",
       "payeeIdType": "ACCOUNT_ID",
       "sendAmount": "100",
       "sendCurrency": "GBP",
       "transactionType": "TRANSFER",
       "payer": { "name": "John LIng", "payerId": "0771234567" }
   }
{
    "payeeDetails": {
        "idType": "MSISDN",
        "idValue": "447903690475",
        "fspId": "dfsp2",
        "name": "John Doe",
        "fspLEI": "1234567890ABCDEFGHIJK"
    },
    "sendAmount": "100",
    "sendCurrency": "GBP",
    "receiveAmount": "No payee receive amount",
    "receiveCurrency": "GMD",
    "targetFees": "0",
    "sourceFees": "0",
    "transactionId": "01KZ6G9QX1HDKZ6Z444EQ928E5",
    "homeTransactionId": "HTX1234S"
}
   {
    "status": "2000",
    "message": "Request failed with status code 500",
    "details": {
        "res": "{\"message\":\"Got an error response resolving party: {\\\"errorInformation\\\":{\\\"errorDescription\\\":\\\"Unknown error\\\",\\\"extensionList\\\":{\\\"extension\\\":[{\\\"key\\\":\\\"Assgnmt.MsgId\\\",\\\"value\\\":\\\"01KZ6G4W4M4XQ4F9WYM9EHJ3HP\\\"},{\\\"key\\\":\\\"Assgnmt.CreDtTm\\\",\\\"value\\\":\\\"2026-08-04T13:41:57.013Z\\\"},{\\\"key\\\":\\\"Rpt.Vrfctn\\\",\\\"value\\\":false}]}}}\",\"transferState\":{\"homeTransactionId\":\"HTX1234\",\"from\":{\"idType\":\"MSISDN\",\"idValue\":\"0771234567\",\"fspId\":\"bluebank\",\"displayName\":\"John LIng\",\"firstName\":\"John LIng\",\"middleName\":\"John LIng\",\"lastName\":\"John LIng\",\"supportedCurrencies\":[\"GMD\"]},\"to\":{\"idType\":\"ACCOUNT_ID\",\"idValue\":\"1234567890\"},\"amountType\":\"SEND\",\"currency\":\"GBP\",\"amount\":\"100\",\"transactionType\":\"TRANSFER\",\"transferId\":\"01KZ6G4VRF3J2C8C208661XMC1\",\"traceId\":\"f9aa9106e5ff1782d45abebe8fbd1571\",\"currentState\":\"ERROR_OCCURRED\",\"initiatedTimestamp\":\"2026-08-04T13:41:56.637Z\",\"direction\":\"OUTBOUND\",\"getPartiesRequest\":{\"withCredentials\":false,\"transitional\":{\"clarifyTimeoutError\":true},\"method\":\"GET\",\"baseURL\":\"http://ttk-hub:4040\",\"url\":\"/parties/ACCOUNT_ID/1234567890\",\"headers\":{\"content-type\":\"application/vnd.interoperability.iso20022.parties+json;version=2.0\",\"date\":\"Tue, 04 Aug 2026 13:41:56 GMT\",\"fspiop-source\":\"dfsp1\",\"Authorization\":\"Bearer 7718fa9b-be13-3fe7-87f0-a12cf1628168\",\"accept\":\"application/vnd.interoperability.iso20022.parties+json;version=2\",\"traceparent\":\"00-f9aa9106e5ff1782d45abebe8fbd1571-99f997fb61328948-01\"},\"httpAgent\":\"[REDACTED]\"},\"getPartiesResponse\":{\"body\":{\"errorInformation\":{\"errorDescription\":\"Unknown error\",\"extensionList\":{\"extension\":[{\"key\":\"Assgnmt.MsgId\",\"value\":\"01KZ6G4W4M4XQ4F9WYM9EHJ3HP\"},{\"key\":\"Assgnmt.CreDtTm\",\"value\":\"2026-08-04T13:41:57.013Z\"},{\"key\":\"Rpt.Vrfctn\",\"value\":false}]}}},\"headers\":{\"content-type\":\"application/vnd.interoperability.iso20022.parties+json;version=2.0\",\"date\":\"Tue, 04 Aug 2026 13:41:57 GMT\",\"fspiop-source\":\"dfsp2\",\"fspiop-destination\":\"dfsp1\",\"authorization\":\"Bearer 7718fa9b-be13-3fe7-87f0-a12cf1628168\",\"traceparent\":\"00-f9aa9106e5ff1782d45abebe8fbd1571-99f997fb61328948-01\",\"user-agent\":\"axios/1.8.2\",\"accept-encoding\":\"gzip, compress, deflate, br\",\"connection\":\"keep-alive\",\"content-length\":256,\"host\":\"dfsp1-sdk-api-svc:4000\"}},\"lastError\":{\"httpStatusCode\":500,\"mojaloopError\":{\"errorInformation\":{\"errorDescription\":\"Unknown error\",\"extensionList\":{\"extension\":[{\"key\":\"Assgnmt.MsgId\",\"value\":\"01KZ6G4W4M4XQ4F9WYM9EHJ3HP\"},{\"key\":\"Assgnmt.CreDtTm\",\"value\":\"2026-08-04T13:41:57.013Z\"},{\"key\":\"Rpt.Vrfctn\",\"value\":false}]}}}}},\"statusCode\":\"500\"}",
        "headers": "content-type: application/json; charset=utf-8\ncontent-length: 2539\ndate: Tue, 04 Aug 2026 13:41:57 GMT\nconnection: keep-alive\nkeep-alive: timeout=5"
    }
}


{
    "status": "2000",
    "message": "Committing Payment with homeTransactionId HTX1234 failed. Message {\"message\":\"Request failed with status code 500\",\"name\":\"AxiosError\",\"stack\":\"AxiosError: Request failed with status code 500\\n    at settle (/opt/app/node_modules/axios/dist/node/axios.cjs:2049:12)\\n    at IncomingMessage.handleStreamEnd (/opt/app/node_modules/axios/dist/node/axios.cjs:3166:11)\\n    at IncomingMessage.emit (node:events:520:35)\\n    at endReadableNT (node:internal/streams/readable:1701:12)\\n    at process.processTicksAndRejections (node:internal/process/task_queues:89:21)\\n    at Axios.request (/opt/app/node_modules/axios/dist/node/axios.cjs:4276:41)\\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\\n    at async AxiosHTTPClient.send (/opt/app/node_modules/@mojaloop/core-connector-lib/dist/infra/axiosHttpClient/axiosClient.js:51:21)\\n    at async SDKClient.makeRequestWithRetries (/opt/app/node_modules/@mojaloop/core-connector-lib/dist/domain/SDKClient/SDKClient.js:67:29)\\n    at async SDKClient.updateTransfer (/opt/app/node_modules/@mojaloop/core-connector-lib/dist/domain/SDKClient/SDKClient.js:56:21)\\n    at async DFSPCoreConnectorAggregate.updateSendMoney (/opt/app/node_modules/@mojaloop/core-connector-lib/dist/domain/dfspCoreConnectorAgg.js:479:13)\\n    at async DFSPCoreConnectorRoutes.updateInitiatedTransfer (/opt/app/node_modules/@mojaloop/core-connector-lib/dist/core-connector-svc/dfspCoreConnectorRoutes.js:73:39)\\n    at async OpenAPIBackend.handleRequest (/opt/app/node_modules/openapi-backend/backend.js:223:26)\\n    at async exports.Manager.execute (/opt/app/node_modules/@hapi/hapi/lib/toolkit.js:60:28)\\n    at async internals.handler (/opt/app/node_modules/@hapi/hapi/lib/handler.js:46:20)\",\"config\":{\"transitional\":{\"silentJSONParsing\":true,\"forcedJSONParsing\":true,\"clarifyTimeoutError\":true},\"adapter\":[\"xhr\",\"http\",\"fetch\"],\"transformRequest\":[null],\"transformResponse\":[null],\"timeout\":10000,\"xsrfCookieName\":\"XSRF-TOKEN\",\"xsrfHeaderName\":\"X-XSRF-TOKEN\",\"maxContentLength\":-1,\"maxBodyLength\":-1,\"env\":{},\"headers\":{\"Accept\":\"application/json\",\"Content-Type\":\"application/json\",\"User-Agent\":\"axios/1.9.0\",\"Content-Length\":\"32\",\"Accept-Encoding\":\"gzip, compress, deflate, br\"},\"url\":\"http://dfsp1-sdk-api-svc:4001/transfers/01KXZJBYVHR940R5X30805HAQA\",\"data\":\"{\\\"acceptQuoteOrConversion\\\":true}\",\"method\":\"put\",\"allowAbsoluteUrls\":true},\"code\":\"ERR_BAD_RESPONSE\",\"status\":500}. If payment failed in the switch, a refund was triggered."
}

{
    "transferId": "01KZ6G9QX1HDKZ6Z444EQ928E5",
    "currentState": "COMPLETED",
    "initiatedTimestamp": "2026-08-04T13:58:13.458Z",
    "direction": "OUTBOUND",
    "fulfil": {
        "body": {
            "fulfilment": "1234567890ABCDEF",
            "transferState": "COMMITTED",
            "extensionList": {
                "extension": [
                    {
                        "key": "GrpHdr.MsgId",
                        "value": "12345"
                    },
                    {
                        "key": "GrpHdr.CreDtTm",
                        "value": "2026-08-04T13:56:22.930Z"
                    },
                    {
                        "key": "TxInfAndSts.StsId",
                        "value": "12345"
                    },
                    {
                        "key": "TxInfAndSts.OrgnlInstrId",
                        "value": "12345"
                    },
                    {
                        "key": "TxInfAndSts.OrgnlEndToEndId",
                        "value": "12345"
                    },
                    {
                        "key": "TxInfAndSts.OrgnlTxId",
                        "value": "12345"
                    },
                    {
                        "key": "TxInfAndSts.OrgnlUETR",
                        "value": "123e4567-e89b-12d3-a456-426614174000"
                    },
                    {
                        "key": "TxInfAndSts.AccptncDtTm",
                        "value": "2026-08-04T13:56:22.930Z"
                    },
                    {
                        "key": "TxInfAndSts.AcctSvcrRef",
                        "value": "ACCTSVCRREF"
                    },
                    {
                        "key": "TxInfAndSts.ClrSysRef",
                        "value": "CLRSYSREF"
                    },
                    {
                        "key": "TxInfAndSts.SplmtryData.PlcAndNm",
                        "value": "PLACE"
                    },
                    {
                        "key": "TxInfAndSts.PrcgDt.Dt",
                        "value": "2013-03-07"
                    }
                ]
            }
        },
        "headers": {
            "content-type": "application/vnd.interoperability.iso20022.transfers+json;version=2.0",
            "date": "Tue, 04 Aug 2026 13:58:13 GMT",
            "fspiop-source": "dfsp1",
            "user-agent": "axios/1.7.7",
            "content-length": 431,
            "accept-encoding": "gzip, compress, deflate, br",
            "host": "dfsp1-sdk-api-svc:4000",
            "connection": "keep-alive"
        }
    }
}