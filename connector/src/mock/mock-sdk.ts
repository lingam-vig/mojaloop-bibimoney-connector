import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.status(200).json({ status: 'ok' }));

// Party lookup
app.get('/parties/:idType/:idValue', (req, res) => {
    console.log(`[MOCK SDK] Party lookup: ${req.params.idType}/${req.params.idValue}`);
    res.status(200).json({
        idType:         req.params.idType,
        idValue:        req.params.idValue,
        displayName:    'Test Payee',
        firstName:      'Test',
        lastName:       'Payee',
        middleName:     '',
        dateOfBirth:    '1990-01-01',
        fspId:          'payee-dfsp',
        merchantClassificationCode: '5311',
        type:           'CONSUMER',
        supportedCurrencies: ['GMD'],
        kycInformation: 'Verified',
    });
});

// Outbound transfer (CC calls this after acceptQuote: true)
app.post('/transfers', (req, res) => {
    console.log('[MOCK SDK] FULL REQUEST BODY:', JSON.stringify(req.body, null, 2));

    const transferId    = crypto.randomUUID();
    const quoteId       = crypto.randomUUID();
    const transactionId = crypto.randomUUID();

     const ilpData = {
        quoteId,
        transactionId,
        amount: req.body.amount,
        currency: req.body.currency,
        condition: "mock-condition",
        expiration: new Date(Date.now() + 60000).toISOString()
    };

    const response = {
        transferId,
        homeTransactionId:  req.body.homeTransactionId,
        currentState:       'WAITING_FOR_QUOTE_ACCEPTANCE',
        amountType:         req.body.amountType,
        currency:           req.body.currency,
        amount:             req.body.amount,
        transactionType:    req.body.transactionType,
        from:               req.body.from,
        to: {
            ...req.body.to,
            fspId:               'payee-dfsp',
            displayName:         'Test Payee',
            firstName:           'Test',
            lastName:            'Payee',
            supportedCurrencies: [req.body.currency],
        },

        // Path 1: transfer.quote.payeeReceiveAmount  (flat strings)
        quote: {
            quoteId,
            transactionId,
            transferAmount:                   req.body.amount,
            transferAmountCurrency:           req.body.currency,
            payeeReceiveAmount:               req.body.amount,        // ← flat string
            payeeReceiveAmountCurrency:       req.body.currency,
            payeeFspFeeAmount:                '2.00',
            payeeFspFeeAmountCurrency:        req.body.currency,
            payeeFspCommissionAmount:         '0',
            payeeFspCommissionAmountCurrency: req.body.currency,
            expiration: new Date(Date.now() + 60_000).toISOString(),
        },

        // Path 2: transfer.quoteResponse.body.payeeReceiveAmount.amount (nested objects)
        quoteResponse: {
            body: {
                quoteId,
                transactionId,
                transferAmount: {
                    amount:   req.body.amount,
                    currency: req.body.currency,
                },
                payeeReceiveAmount: {
                    amount:   req.body.amount,      // ← nested object
                    currency: req.body.currency,
                },
                payeeFspFee: {
                    amount:   '2.00',
                    currency: req.body.currency,
                },
                payeeFspCommission: {
                    amount:   '0',
                    currency: req.body.currency,
                },
                expiration: new Date(Date.now() + 60_000).toISOString(),
            },
            headers: {},
        },
         // ⭐ REQUIRED BY DFSP CONNECTOR
        ilpPacket: {
            data: ilpData
        },

        condition: ilpData.condition,
        expiration: ilpData.expiration
    };

    console.log('[MOCK SDK] RESPONSE:', JSON.stringify(response, null, 2));
    res.status(200).json(response);
});
// Transfer update (PATCH/PUT)
app.put('/transfers/:transferId', (req, res) => {
    console.log(`[MOCK SDK] Transfer update: ${req.params.transferId}`);
    console.log(`[MOCK SDK] PUT /transfers/${req.params.transferId}`);
    console.log('[MOCK SDK] Body:', JSON.stringify(req.body, null, 2));
    res.status(200).json({ transferState: 'COMMITTED' });
});

// app.patch('/transfers/:transferId', (req, res) => {
//     console.log(`[MOCK SDK] Transfer patch: ${req.params.transferId}`);
//     res.status(200).json({ transferState: 'COMMITTED' });
// });

app.listen(4001, () => console.log('[MOCK SDK] Running on http://localhost:4001'));