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
        this.logger.info(`BLUE_BANK_API_KEY`, process.env.BLUE_BANK_API_KEY);

        this.logger.info(`BLUE_BANK_URL`, process.env.BLUE_BANK_URL);


       // Validate idType
        if (!deps.accountId) {
            throw AggregateError.idAndIdTypeUndefinedError(
                'ID and ID type are undefined', 
                '3200', 
                400
            );
        }

        //  if (!['MSISDN', 'ACCOUNT_ID'].includes(deps)) {
        // throw AggregateError.unsupportedIdTypeError();
        // }

        const requestBody: TCbsAccountLookupRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            TerminalID: process.env.BLUE_BANK_TERMINALID!,
            AccessKey: process.env.BLUE_BANK_ACCESSKEY!,
            MSISDN: deps.accountId!,
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
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '5000', 500);
        }

        //----------- Response ----------------
        const cbsResponse = response.data;
        this.logger.info(`CBS response: ${JSON.stringify(cbsResponse)}`);

        if (cbsResponse.Status != 'OK') {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error', '5000', 500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== '000') {
            this.logger.error(`CBS account lookup failed: ${cbsResponse.ErrorText}`);
            
            this.handleCbsLookupStatus(cbsResponse.StatusCode, cbsResponse.ErrorText);
           
        }

        const accountInfo = cbsResponse.Information;
        if (!accountInfo) {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error- No account info found', '5000', 500);
            //throw AggregateError.invalidAccountNumberError();
        }

        // Check account is active
        if (accountInfo.AccountStatus !== 'ACTIVE') {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error- Account status not active', '5000', 500);
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
        this.logger.info(`Processing quoteRequest`, quoteRequest);

        this.logger.info(`${process.env.BLUE_BANK_URL}/transaction/runlookup`);

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
            DestinationAccountType:     'MSISDN',
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
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '5000', 500);
        }

        const cbsResponse = response.data;

        this.logger.info(`CBS tx lookup response: ${JSON.stringify(cbsResponse)}`);

         if (cbsResponse.Status != 'OK') {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error', cbsResponse.StatusCode, 500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== 'TransactionSuccess') {
            this.logger.error(`CBS tx fee lookup failed: ${cbsResponse.ErrorText}`);
            
            this.handleCbsTransactionStatus(cbsResponse.StatusCode, cbsResponse.ErrorText);
           
        }

        const txInfo = cbsResponse.Information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No fee data returned', '2000', 500);
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
        } else if (transfer.to.idValue === '+2203628890') {
            // abort
            throw ConnectorError.cbsConfigUndefined('Abort Transfer', '2000', 500);
        }

        const uniqueId = crypto.randomUUID(); // accepts UUID
        // Build request
        const requestBody: TCbsReserveRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            TerminalID: process.env.BLUE_BANK_TERMINALID!,
            AccessKey: process.env.BLUE_BANK_ACCESSKEY!,

            amount:                     transfer.amount,
            currency:                   transfer.currency,
            transactionType:            transfer.transactionType, // e.g. "TRANSFER"|"PAYMENT"|"DEPOSIT"
            transactionId:              transfer.transferId, // Mojaloop switch UUID
            switchReference:               uniqueId,           // CBS reference
            narration:                  transfer.from.displayName ?? transfer.from.lastName,
            fromAccount:                transfer.from.idValue,
            fromAccountType:            transfer.from.idType,
            toAccount:                  transfer.to.idValue,
            toAccountType:              transfer.to.idType,
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
            throw ConnectorError.cbsConfigUndefined('CBS API unreachable', '5000', 500);
        }
       
        const cbsResponse = response.data;

         this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

         if (cbsResponse.Status != 'OK') {
            throw ConnectorError.cbsConfigUndefined(cbsResponse.ErrorText ?? 'CBS error', '5000', 500);
        }

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== 'TransactionSuccess') {
            this.handleCbsTransactionStatus(cbsResponse.StatusCode, cbsResponse.ErrorText);
        }

        const txInfo = cbsResponse.Information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No data returned', '2000', 500);
        }

          if (txInfo.status != 'SUCCESS') {
            throw ConnectorError.cbsConfigUndefined(txInfo?.message ?? 'reserved failed', '2000', 500);
        }
        const transferResponse = {
            homeTransactionId: uniqueId, // CBS reference
            transferState: 'RESERVED' as components["schemas"]["transferState"],
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

            transactionId:               transferUpdate.transferId,
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

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== 'TransactionSuccess') {
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

            transferId:                     transferUpdate.transferId,
            switchReference:                transferUpdate.homeTransactionId,
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

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== 'TransactionSuccess') {
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

            transferId:              transferId,
            switchReference :      updateSendMoneyDeps.homeTransactionId
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

         if (cbsResponse.Status == 'OK' && cbsResponse.StatusCode !== 'TransactionSuccess') {
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
            NotFoundMSISDN: () => { throw AggregateError.invalidAccountNumberError() },
            NotFoundAccount: () => { throw AggregateError.invalidAccountNumberError() },
            AccountSanctioned: () => { throw AggregateError.invalidAccountNumberError() },
            DoNotHonour: () => { throw AggregateError.accountBarredError() },

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

}

