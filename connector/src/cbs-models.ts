
import type { components } from '@mojaloop/api-snippets/lib/sdk-scheme-adapter/v2_0_0/backend/openapi'

export type TCbsBaseResponse<T> = {
    requestType?: string ;
    Status?: string;
    StatusCode: string;
    ErrorText?: string ;
    Information?: T;
};
export type TCbsAccountLookupRequest = {
    api_key: string;
    api_secret: string;
    MSISDN: string;
    SubId?: string;
    TerminalID: string;
    AccessKey: string;
};

//--- Account lookup
 export type TCbsAccountLookupResponse = {
    IWAN?: string;
    Msisdn?: string;
    Farration: string;
    FirstName?: string;
    AccountName?: string;
    MiddleName?: string;
    LastName?: string;
    DateOfBirth?: string;
    AccountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    Currency?: string;
};
// ─── Transaction Lookup ───

// Lookup Tx Request
export type TCbsFeeRequest = {
    api_key: string;
    api_secret: string;
    TerminalID: string;
    AccessKey: string;

    Amount?: string;
    Currency?: string;
    TransactionType?: string;
    SourceAccountNumber: string;
    DestinationAccountNumber?: string;
    DestinationAccountType?: string; //MSISDN | ACCOUNT_ID
    TxReference?: string;
    QuoteId?: string;
};

//Lookup Response
export type TCbsFeeResponse = {
    TransactionAmount?: string;
    TransactionCurrency: components["schemas"]["currency"];
    FeeAmount?: string;
    FeeCurrency?: components["schemas"]["currency"];
    CommissionAmount?: string;
    CommissionCurrency?: components["schemas"]["currency"];
    TransactionId: string;
    QuoteId: string;
};

// ─── Fund Reserve ───

export type TCbsReserveRequest = {
    api_key: string;
    api_secret: string;
    TerminalID: string;
    AccessKey: string;

    TransactionId?: string;
    SwitchReference?: string;
    Amount: string;
    Currency: string;
    Narration?: string;
    TransactionType: string;
    SourceAccountType: string;
    SourceAccountNumber: string;
    DestinationAccountNumber?: string;
    DestinationAccountType?: string; //MSISDN | ACCOUNT_ID
};

export type TCbsReserveResponse = {
    PSPReference: string;      
    Status: 'SUCCESS' | 'FAILED';
    Message?: string;
};

export type TCbsUnReserveRequest = {

    api_key: string;
    api_secret: string;
    TerminalID: string;
    AccessKey: string;

    TransactionId?: string;
    PSPReference?: string;
   
};

export type TCbsUnReserveResponse = {
    PSPReference: string;      
    status: 'SUCCESS' | 'FAILED';
    message?: string;
};
// ─── Final Transaction ───────

export type TCbsPostingRequest = {
    api_key: string;
    api_secret: string;
    TerminalID: string;
    AccessKey: string;

    SwitchReference?: string;
    TransferId?: string;
};


export type TCbsPostingResponse = {
    PSPReference: string;
    status: 'SUCCESS' | 'FAILED';
    message?: string;
};

// ─── Transaction Reversal ──────────

export type TCbsReversalRequest = {
    api_key: string;
    api_secret: string;
    TerminalID: string;
    AccessKey: string;
    TransferId: string;
    SwitchReference: string;
};

export type TCbsReversalResponse = {
    PSPReference: string;
    status: 'SUCCESS' | 'FAILED';
    message?: string;
};