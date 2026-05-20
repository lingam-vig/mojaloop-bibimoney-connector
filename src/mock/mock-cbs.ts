// mock-cbs.ts — simulates Blue Bank API on a separate port
import express from 'express';

const app = express();
app.use(express.json());

// Log every request hitting the CBS
app.use((req, _res, next) => {
    console.log(`\n[MOCK CBS] ${req.method} ${req.path}`);
    console.log('[MOCK CBS] Body:', JSON.stringify(req.body, null, 2));
    next();
});

// Account lookup — called by getAccountInfo()
app.post('/account/lookup', (req, res) => {
    console.log('[MOCK CBS] Account lookup called');
    res.status(200).json({
        status: 'success',
        statusCode: '200',
        information: {
            IWAN: 'GMD123456',
            msisdn: req.body.MSISDN,
            firstName: 'John',
            middleName: 'Alexander',
            lastName: 'Doe',
            dateOfBirth: '1990-05-15',
            accountStatus: 'ACTIVE',
            currency: 'GMD',
        },
    });
});

// Fee/quote lookup — called by getQuote()
app.post('/transaction/lookup', (req, res) => {
    console.log('[MOCK CBS] Fee lookup called');
    res.status(200).json({
        status: 'success',
        statusCode: '200',
        information: {
            transactionId:      req.body.transactionId,
            quoteId:            req.body.quoteId,
            transactionAmount:  req.body.amount,
            transactionCurrency: req.body.currency,
            feeAmount:          '2.00',
            feeCurrency:        req.body.currency,
        },
    });
});

// Reserve funds — called by reserveFunds()
app.post('/transaction/athorise', (req, res) => {
    console.log('[MOCK CBS] Reserve funds called');
    res.status(200).json({
        status: 'success',
        statusCode: '200',
        information: {
            transactionId: req.body.transactionId,
            status: 'SUCCESS',
            message: 'Funds reserved successfully',
        },
    });
});

// Commit — called by commitReservedFunds()
app.post('/transaction/capture', (req, res) => {
    console.log('[MOCK CBS] Commit funds called');
    res.status(200).json({
        status: 'success',
        statusCode: '200',
        information: {
            transactionId: req.body.homeTransactionId,
            status: 'SUCCESS',
            message: 'Funds committed successfully',
        },
    });
});

// Cancel/unreserve — called by unreserveFunds()
app.post('/transaction/cancel', (req, res) => {
    console.log('[MOCK CBS] Unreserve funds called');
    res.status(200).json({
        status: 'success',
        statusCode: '200',
        information: {
            transactionId: req.body.transactionId,
            status: 'SUCCESS',
            message: 'Funds unreserved successfully',
        },
    });
});

// Refund — called by handleRefund()
app.post('/transaction/refund', (req, res) => {
    console.log('[MOCK CBS] Refund called');
    res.status(200).json({
        status: 'success',
        statusCode: '200',
        information: {
            transactionId: req.body.transferId,
            status: 'SUCCESS',
            message: 'Refund completed successfully',
        },
    });
});

app.listen(8080, () => console.log('[MOCK CBS] Running on http://localhost:8080'));