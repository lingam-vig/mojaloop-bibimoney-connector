
import type { components } from '@mojaloop/api-snippets/lib/sdk-scheme-adapter/v2_0_0/backend/openapi'

export type TCbsBaseResponse<T> = {
    requestType?: string ;
    status?: string;
    statusCode?: string;
    errorText?: string ;
    information?: T;
};
export type TCbsAccountLookupRequest = {
    api_key: string;
    api_secret: string;
    MSISDN: string;
};

//--- Account lookup
 export type TCbsAccountLookupResponse = {
    IWAN?: string;
    msisdn?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    currency?: string;
};
// ─── Transaction Lookup ───

// Lookup Tx Request
export type TCbsFeeRequest = {
    amount?: string;
    currency?: string;
    transactionType?: string;
    sourceAccountNumber: string;
    destinationAccountNumber?: string;
    transactionId?: string;
    quoteId?: string;
};

//Lookup Response
export type TCbsFeeResponse = {
    transactionAmount?: string;
    transactionCurrency: components["schemas"]["currency"];
    feeAmount?: string;
    feeCurrency?: components["schemas"]["currency"];
    commissionAmount?: string;
    commissionCurrency?: components["schemas"]["currency"];
    transactionId: string;
    quoteId: string;
};

// ─── Fund Reserve ───

export type TCbsReserveRequest = {
    transactionId?: string;
    homeTransactionId?: string;
    amount: string;
    currency: string;
    narration?: string;
    transactionType: string;
    fromAccount: string;
    fromAccountType: string;
    toAccount: string;
    toAccountType: string;
};

export type TCbsReserveResponse = {
    PSPReference: string;      
    status: 'SUCCESS' | 'FAILED';
    message?: string;
};

export type TCbsUnReserveRequest = {
    transactionId?: string;
    homeTransactionId?: string;
   
};

export type TCbsUnReserveResponse = {
    PSPReference: string;      
    status: 'SUCCESS' | 'FAILED';
    message?: string;
};
// ─── Final Transaction ───────

export type TCbsPostingRequest = {
    homeTransactionId?: string;
    transferId?: string;
};


export type TCbsPostingResponse = {
    PSPReference: string;
    status: 'SUCCESS' | 'FAILED';
    message?: string;
};

// ─── Transaction Reversal ──────────

export type TCbsReversalRequest = {
    transferId: string;
    homeTransactionId: string;
};

export type TCbsReversalResponse = {
    PSPReference: string;
    status: 'SUCCESS' | 'FAILED';
    message?: string;
};