process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import {
    AggregateError,
    ICbsClient,
    IHTTPClient,
    ILogger,
    Party,
    TCBSConfig,
    TCBSUpdateSendMoneyRequest,
    TGetKycArgs,
    TPayeeExtensionListEntry,
    TQuoteRequest,
    TQuoteResponse,
    TtransferErrorResponse,
    TtransferPatchNotificationRequest,
    TtransferRequest,
    TtransferResponse,
} from '@mojaloop/core-connector-lib';
import { ConnectorError } from './errors';
import type { components } from '@mojaloop/api-snippets/lib/sdk-scheme-adapter/v2_0_0/backend/openapi'
import { TCbsAccountLookupResponse, TCbsBaseResponse, TCbsFeeResponse ,TCbsFeeRequest,TCbsReserveRequest,TCbsReserveResponse, TCbsUnReserveRequest, TCbsUnReserveResponse, TCbsPostingRequest, TCbsReversalRequest, TCbsReversalResponse, TCbsAccountLookupRequest} from './cbs-models';

export class MockCBSClient<D> implements ICbsClient {
    cbsConfig: TCBSConfig<D>;
    httpClient: IHTTPClient;
    logger: ILogger;

    constructor(cbsConfig: TCBSConfig<D>, httpClient: IHTTPClient, logger: ILogger) {
        this.cbsConfig = cbsConfig;
        this.httpClient = httpClient;
        this.logger = logger;
    }

    private getHeaders(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            //"x-api-key": process.env.BLUE_BANK_API_KEY ?? "",
            //"x-api-secret": process.env.BLUE_BANK_API_SECRET ?? ""
        };
    }

    async getAccountInfo(deps: TGetKycArgs): Promise<Party> {
        this.logger.info(`Getting party account information`, deps);
        //if (deps.accountId === '46733123450') {
           // throw ConnectorError.cbsConfigUndefined('Party Not Found', '2000', 500);
       // }
        this.logger.info(`deps.accountId`, deps.accountId);
        this.logger.info(`BLUE_BANK_URL`, process.env.BLUE_BANK_URL);


       // Validate idType

        if (!deps.accountId) {
            throw AggregateError.idAndIdTypeUndefinedError(
                'ID and ID type are undefined', 
                '400', 
                400
            );
        }

        const requestBody: TCbsAccountLookupRequest = {
            api_key:        process.env.BLUE_BANK_API_KEY!,
            api_secret:     process.env.BLUE_BANK_API_SECRET!,
            TerminalID:     process.env.BLUE_BANK_TERMINALID!,
            AccessKey:      process.env.BLUE_BANK_ACCESSKEY!,
            MSISDN:         deps.accountId!,
            SubId:          deps.subId
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        this.logger.info(`${process.env.BLUE_BANK_URL}/account/lookup`);


        let response;
        try {
            response = await this.httpClient.post
                <TCbsAccountLookupRequest,
                TCbsBaseResponse<TCbsAccountLookupResponse>>(
                `${process.env.BLUE_BANK_URL}/account/lookup`,
                requestBody,
                { headers },
            );
        } catch (error) {
            this.logger.error(`CBS API unreachable: ${error}`);
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '1001', 500);
        }

        //----------- Response ----------------
        const cbsResponse = response.data;
        this.logger.info(`CBS response: ${JSON.stringify(cbsResponse)}`);

        if (cbsResponse.Status != 'OK') {

            // auth error
            if(cbsResponse.StatusCode == '400')
            {
                throw ConnectorError.cbsConfigUndefined('auth error', '3200', 500);
            }

            if(cbsResponse.StatusCode == '910' || cbsResponse.StatusCode == '920')
            {
                throw ConnectorError.cbsConfigUndefined('Internal server error', '2001', 500);
            }

            // 310 | 320 | 330 | 340 | 400 | 510   
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS validation error', '3100',500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== '000') {
            this.logger.error(`CBS account lookup failed: ${cbsResponse.ErrorText}`);
            
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS validation error', '3000',500);
           
        }

        const accountInfo = cbsResponse.Information;
        if (!accountInfo) {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error- No account info found', '3203', 500);
            //throw AggregateError.invalidAccountNumberError();
        }

        // Check account is active
        if (accountInfo.AccountStatus !== 'ACTIVE') {
            throw ConnectorError.cbsConfigUndefined('Account is not active', '5200', 500);
        }

        const party = {
            dateOfBirth:    accountInfo.DateOfBirth ?? '',
            displayName:    accountInfo.AccountName ?? "",
            firstName:      accountInfo.FirstName ?? '',
            fspId:          this.cbsConfig.FSP_ID,
            idSubValue:     deps.subId,
            idType:         'MSISDN',
            idValue:        accountInfo.Msisdn ?? deps.accountId,
            lastName:       accountInfo.LastName ?? '',
            merchantClassificationCode: '5311',
            middleName:     accountInfo.MiddleName ?? '',
            type:           'PERSON',
            supportedCurrencies: accountInfo.Currency ?? this.cbsConfig.CURRENCY,
            kycInformation: 'Verified',
        };

        // Log response
        this.logger.debug('Party', party);
        return party;
    }

    getAccountDiscoveryExtensionLists(): TPayeeExtensionListEntry[] {
        return [
            {
                key: 'Rpt.UpdtdPtyAndAcctId.Agt.FinInstnId.LEI',
                value: '01HTZ7V7JEMZ6NR90YKE6XK2X3',
            },
        ];
    }

    async getQuote(quoteRequest: TQuoteRequest): Promise<TQuoteResponse> {
        this.logger.info("Incoming quoteRequest BEFORE VALIDATION", { payload: quoteRequest });
        this.logger.info(`${process.env.BLUE_BANK_URL}/transaction/runlookup`);

        // Validate idType

        if (quoteRequest.to?.idType !== 'MSISDN' && quoteRequest.to?.idType !== 'ACCOUNT_NO')
        {
            throw AggregateError.idAndIdTypeUndefinedError(
                            'Invalid to IdType', 
                            '400', 
                            400
                        );
        }

        // Build request
        const requestBody: TCbsFeeRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            TerminalID: process.env.BLUE_BANK_TERMINALID!,
            AccessKey: process.env.BLUE_BANK_ACCESSKEY!,

            Amount:                     quoteRequest.amount,
            Currency:                   this.cbsConfig.CURRENCY,
            TransactionType:            quoteRequest.transactionType, // e.g. "TRANSFER"
            SourceAccountNumber:        quoteRequest.from.idValue,
            DestinationAccountNumber:   quoteRequest.to?.idValue,
            DestinationAccountType:     quoteRequest.to?.idType, 
            TxReference:                quoteRequest.transactionId,
            QuoteId :                   quoteRequest.quoteId,
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        

        let response;
        try {
            response = await this.httpClient.post<
                TCbsFeeRequest,
                TCbsBaseResponse<TCbsFeeResponse>
            >(
                `${process.env.BLUE_BANK_URL}/transaction/runlookup`,
                requestBody,
                { headers },
            );
        } catch (error) {
            this.logger.error(`CBS API unreachable: ${error}`);
             throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '1001', 500);
        }

        const cbsResponse = response.data;

        this.logger.info(`CBS tx getQuote response: ${JSON.stringify(cbsResponse)}`);

         if (cbsResponse.Status != 'OK') {

              // auth error
            if(cbsResponse.StatusCode == '400')
            {
                throw ConnectorError.cbsConfigUndefined('auth error', '3200', 500);
            }

            if(cbsResponse.StatusCode == '910' || cbsResponse.StatusCode == '920')
            {
                var code = this.mapError(cbsResponse.ErrorText ?? 'Internal server error');

                throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'Internal server error', code, 500);
            }

            // 310 | 320 | 330 | 340 | 400 | 510   
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS validation error', '3100',500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== '000') {
            this.logger.error(`CBS tx fee lookup failed: ${cbsResponse.ErrorText}`);
            
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS validation error', '3100',500);
           
        }

        const txInfo = cbsResponse.Information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No fee data returned', '3100',500);
        }

        const QuoteResponse = {
            payeeFspCommissionAmountCurrency:   txInfo.TransactionCurrency,
            payeeFspFeeAmount:                  txInfo.FeeAmount,
            payeeFspFeeAmountCurrency:          txInfo.FeeCurrency ?? this.cbsConfig.CURRENCY,
            payeeReceiveAmount:                 txInfo.TransactionAmount,
            payeeReceiveAmountCurrency:         txInfo.TransactionCurrency ?? this.cbsConfig.CURRENCY,
            quoteId:                            txInfo.QuoteId,
            transactionId:                      txInfo.TransactionId,
            transferAmount:                     quoteRequest.amount,
            transferAmountCurrency:             txInfo.FeeCurrency ?? this.cbsConfig.CURRENCY,
        };

        // Log response
        this.logger.debug('TQuoteResponse', QuoteResponse);
        return QuoteResponse;
    }

    async reserveFunds(transfer: TtransferRequest): Promise<TtransferResponse> {
        this.logger.info(`Reserving funds for transfer request`, transfer);
        if (transfer.to.idValue === '+2203628891') {
            // timeout
            await new Promise((resolve) => setTimeout(resolve, 300_000));
        } 

        if (transfer.to?.idType !== 'MSISDN' && transfer.to?.idType !== 'ACCOUNT_NO')
        {
            throw AggregateError.idAndIdTypeUndefinedError(
                            'Invalid to IdType', 
                            '400', 
                            400
                        );
        }

        const uniqueId = crypto.randomUUID(); // accepts UUID
        // Build request
        const requestBody: TCbsReserveRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            TerminalID: process.env.BLUE_BANK_TERMINALID!,
            AccessKey: process.env.BLUE_BANK_ACCESSKEY!,

            Amount:                     transfer.amount,
            Currency:                   transfer.currency,
            TransactionType:            transfer.transactionType, // e.g. "TRANSFER"|"PAYMENT"|"DEPOSIT"
            TransactionId:              transfer.transferId, // Mojaloop switch UUID
            SwitchReference:            uniqueId,           // CBS reference
            Narration:                  transfer.from.displayName ?? transfer.from.lastName,
            SourceAccountNumber:        transfer.from.idValue,
            SourceAccountType:          transfer.from.idType,
            DestinationAccountNumber:   transfer.to.idValue,
            DestinationAccountType:     transfer.to.idType,
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        
        let response;
        try {
            response = await this.httpClient.post<
            TCbsReserveRequest,
            TCbsBaseResponse<TCbsReserveResponse>
        >(
            `${process.env.BLUE_BANK_URL}/transaction/athorise`,
            requestBody,
            { headers },
        );
        } catch (error) {
            this.logger.error(`CBS API unreachable: ${error}`);
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '1001', 500);
        }
       
        
        const cbsResponse = response.data;

         this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

          if (cbsResponse.Status != 'OK') {

              // auth error
            if(cbsResponse.StatusCode == '400')
            {
                throw ConnectorError.cbsConfigUndefined('auth error', '3200', 500);
            }

            if(cbsResponse.StatusCode == 'DUPLICATE')
            {
                throw ConnectorError.cbsConfigUndefined('Duplicate transaction', '3200', 500);
            }

            if(cbsResponse.StatusCode == '910' || cbsResponse.StatusCode == '920')
            {
                var code = this.mapError(cbsResponse.ErrorText ?? 'Internal server error');

                throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'Internal server error', code, 500);
            }

            // 310 | 320 | 330 | 340 | 400 | 510   
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS validation error', '3100', 500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== '000') {
            this.logger.error(`CBS tx fee lookup failed: ${cbsResponse.ErrorText}`);
            
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS validation error', '3100',500);
           
        }

        const txInfo = cbsResponse.Information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No fee data returned', '3100',500);
        }

        if (txInfo.Status != 'SUCCESS') {
            throw ConnectorError.cbsConfigUndefined(txInfo?.Message ?? 'reserved failed', '2000', 500);
        }

       // If this MSISDN should simulate abort AFTER reserve
        // if (transfer.to.idValue === '447903690471') {
        //      const transferAbortResponse = {
        //        homeTransactionId: uniqueId, // CBS reference
        //     transferState: 'ABORTED' as components["schemas"]["transferState"],
        //     to: {
        //         idType: transfer.to.idType,
        //         idValue: transfer.to.idValue,
        //     },
        //     from: {
        //         idType: transfer.from.idType,
        //         idValue: transfer.from.idValue,
        //     },
        //     amount: transfer.amount,
        //     currency: transfer.currency,
        //     };
        //     this.logger.debug('transferAbortResponse', transferAbortResponse);
        //     return transferAbortResponse;
        // }

        const transferResponse = {
            homeTransactionId: uniqueId, // CBS reference
            transferState: 'RESERVED' as components["schemas"]["transferState"],
                    // ✅ Add these back
            to: {
                idType: transfer.to.idType,
                idValue: transfer.to.idValue,
            },
            from: {
                idType: transfer.from.idType,
                idValue: transfer.from.idValue,
            },
            amount: transfer.amount,
            currency: transfer.currency,
        };

        // Log response
        this.logger.debug('transferResponse', transferResponse);
        return transferResponse;
    }

    async unreserveFunds(transferUpdate: TtransferPatchNotificationRequest): Promise<void> {
        this.logger.info(`Unreserving funds for request `, transferUpdate);

   
        // Build request
        const requestBody: TCbsUnReserveRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            TerminalID: process.env.BLUE_BANK_TERMINALID!,
            AccessKey: process.env.BLUE_BANK_ACCESSKEY!,

            TransactionId:               transferUpdate.transferId,
            PSPReference:                transferUpdate.homeTransactionId
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        
        let response;
        try {
            response = await this.httpClient.post<
            TCbsUnReserveRequest,
            TCbsBaseResponse<TCbsUnReserveResponse>
        >(
            `${process.env.BLUE_BANK_URL}/transaction/cancel`,
            requestBody,
            { headers },
        );
        } catch (error) {
            this.logger.error(`CBS API unreachable: ${error}`);
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '5000', 500);
        }
        
        const cbsResponse = response.data;

        this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

         if (cbsResponse.Status != 'OK') {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error', '5000', 500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== '000') {
            this.handleCbsTransactionStatus(cbsResponse.StatusCode, cbsResponse.ErrorText);
        }
        const txInfo = cbsResponse.Information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No data returned', '2000', 500);
        }

        return ;
    }

    async commitReservedFunds(transferUpdate: TtransferPatchNotificationRequest): Promise<void> {
        this.logger.info(`Committing funds for request `, transferUpdate);

        
        // Build request
        const requestBody: TCbsPostingRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            TerminalID: process.env.BLUE_BANK_TERMINALID!,
            AccessKey: process.env.BLUE_BANK_ACCESSKEY!,

            TransferId:                     transferUpdate.transferId,
            SwitchReference:                transferUpdate.homeTransactionId, 
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        

        let response;
        try {
            response = await this.httpClient.post<
                TCbsPostingRequest,
                TCbsBaseResponse<TCbsUnReserveResponse>
            >(
                `${process.env.BLUE_BANK_URL}/transaction/capture`,
                requestBody,
                { headers },
            );
        } catch (error) {
            this.logger.error(`CBS API unreachable: ${error}`);
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '5000', 500);
        }
        const cbsResponse = response.data;

        this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

        if (cbsResponse.Status != 'OK') {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error', '5000', 500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== '000') {
            this.handleCbsTransactionStatus(cbsResponse.StatusCode, cbsResponse.ErrorText);
        }
        const txInfo = cbsResponse.Information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No data returned', '2000', 500);
        }
        return;
    }

    async handleRefund(
        updateSendMoneyDeps: TCBSUpdateSendMoneyRequest,
        transferId: string,
        transferRes: TtransferErrorResponse,
    ): Promise<void> {
        this.logger.info(`Processing refund for req ${updateSendMoneyDeps} and transferId ${transferId}`);

        // Build request
        const requestBody: TCbsReversalRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            TerminalID: process.env.BLUE_BANK_TERMINALID!,
            AccessKey: process.env.BLUE_BANK_ACCESSKEY!,

            TransferId:              transferId,
            SwitchReference :      updateSendMoneyDeps.homeTransactionId
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        
        let response;
        try {
             response = await this.httpClient.post<
            TCbsReversalRequest,
            TCbsBaseResponse<TCbsReversalResponse>
                >(
                    `${process.env.BLUE_BANK_URL}/transaction/refund`,
                    requestBody,
                    { headers },
                );
        } catch (error) {
            this.logger.error(`CBS API unreachable: ${error}`);
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '5000', 500);
        }

        const cbsResponse = response.data;

        this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

        if (cbsResponse.Status != 'OK') {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error', '5000', 500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== '000') {
            this.handleCbsTransactionStatus(cbsResponse.StatusCode, cbsResponse.ErrorText);
        }
        const txInfo = cbsResponse.Information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No data returned', '2000', 500);
        }

        this.logger.debug('transferResponse', 'REFUND COMPLETED');
        return;
    }

    handleCbsLookupStatus(statusCode: string, errorText?: string) {
        const handlers: Record<string, () => never> = {
            NotFoundMSISDN: () => {  throw ConnectorError.cbsConfigUndefined('MSISDN is not found', '3204',500) },
            NotFoundAccount: () => { throw ConnectorError.cbsConfigUndefined('Account not found', '3203',500) },
            AccountSanctioned: () => { throw ConnectorError.cbsConfigUndefined('Account sanctioned', '5200',500) },
            DoNotHonour: () => { throw ConnectorError.cbsConfigUndefined('DO NOT HONOUR', '5200',500) },

        };
//
        const handler = handlers[statusCode];

        if (handler) {
            handler();
        }

         throw ConnectorError.cbsConfigUndefined(
            errorText ?? 'CBS validation error',
            '3100',
            500
        );
    }

    handleCbsTransactionStatus(statusCode: string, errorText?: string) {
        const handlers: Record<string, () => never> = {
            NotFoundMSISDN: () => { throw AggregateError.invalidAccountNumberError() },
            NotFoundAccount: () => { throw AggregateError.invalidAccountNumberError() },
            AccountSanctioned: () => { throw AggregateError.invalidAccountNumberError() },
            DoNotHonour: () => { throw AggregateError.accountBarredError() },
            NotPermitted: () => { throw ConnectorError.cbsConfigUndefined('Product not permitted', '5000',500) },
            InvalidCurrency: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
            LimitExceededTransaction: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
            InvalidAmount: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
            DuplicateTransactionStatus: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
            NotFoundTransaction: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
            LimitExceededTransactionCount: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
            LimitExceededTransactionFrequency: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
            InvalidKYC: () => { throw ConnectorError.cbsConfigUndefined(errorText!, '5000',500) },
        };

        const handler = handlers[statusCode];

        if (handler) {
            handler();
        }

         throw ConnectorError.cbsConfigUndefined(
            errorText ?? 'CBS error',
            '5000',
            500
        );
    }

    mapError(msg: string): string {
    const m = msg.toUpperCase();

    const rules: Array<{ match: string[]; code: string }> = [
        { match: ["CLI_NOT_FOUND"], code: "3200" },
        { match: ["ACCOUNT_CLI_NOT_LOCAL", "INVALID_CLI"], code: "3200" },
        { match: ["ACCOUNT_REF_NOT_EXIST", "ACCOUNT_NOT_FOUND"], code: "2000" },
        { match: ["ACCOUNT_FROZEN"], code: "5400" },
        { match: ["ACCOUNT_NOT_ACTIVE"], code: "5400" },
        { match: ["ACCOUNT_CANNOT_BE_SAME", "CUSTOMER_SAME_DENIED"], code: "5000" },
        { match: ["ACCOUNT_SANCTIONED"], code: "5200" },
        { match: ["PRODUCT_INACTIVE", "PRODUCT_TMP_UNAVAILABLE"], code: "2002" },
        { match: ["TX_CURRENCY_MISMATCH", "CURRENCY_NOT_EXIST", "CURRENCY_NOT_TRANSACT"], code: "5106" },
        { match: ["TX_AMOUNT_MIN_VALUE", "TX_AMOUNT_INVALID"], code: "5200" }, // limit error
        { match: ["TX_AMOUNT_MAX_VALUE"], code: "5200" }, 
        // LIMIT ERRORS
        { match: ["LIMIT"], code: "4200" },
    ];

   for (const rule of rules) {
        if (rule.match.some(key => m.includes(key))) {
            return rule.code;
        }
    }

    return "3100"; // default
}


}

