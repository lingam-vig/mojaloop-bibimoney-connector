import {
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
        if (deps.accountId === '46733123450') {
            throw ConnectorError.cbsConfigUndefined('Party Not Found', '2000', 500);
        }

        const requestBody: TCbsAccountLookupRequest = {
            api_key: process.env.BLUE_BANK_API_KEY!,
            api_secret: process.env.BLUE_BANK_API_SECRET!,
            MSISDN: deps.accountId!,
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);

        const response = await this.httpClient.post<
            TCbsAccountLookupRequest,
            TCbsBaseResponse<TCbsAccountLookupResponse>
        >(
            `${process.env.BLUE_BANK_URL}/account/lookup`,
            requestBody,
            { headers },
        );

        //----------- Response ----------------
        const cbsResponse = response.data;

        this.logger.info(`CBS response: ${JSON.stringify(cbsResponse)}`);

        // Check for CBS-level errors
        if (cbsResponse.status !== 'success' || cbsResponse.statusCode !== '200') {
            this.logger.error(`CBS account lookup failed: ${cbsResponse.errorText}`);
            throw ConnectorError.cbsConfigUndefined(
                cbsResponse.errorText ?? 'Account lookup failed',
                cbsResponse.statusCode ?? '500',
                500,
            );
        }

        const accountInfo = cbsResponse.information;
        if (!accountInfo) {
            throw ConnectorError.cbsConfigUndefined('No account information returned', '2000', 500);
        }

        // Check account is active
        if (accountInfo.accountStatus !== 'ACTIVE') {
            throw ConnectorError.cbsConfigUndefined(
                `Account is ${accountInfo.accountStatus}`,
                '2000',
                500,
            );
        }

        const party = {
            dateOfBirth:    accountInfo.dateOfBirth ?? '',
            displayName:    `${accountInfo.firstName} ${accountInfo.lastName}`,
            firstName:      accountInfo.firstName ?? '',
            fspId:          this.cbsConfig.FSP_ID,
            idSubValue:     deps.subId,
            idType:         'MSISDN',
            idValue:        accountInfo.msisdn ?? deps.accountId,
            lastName:       accountInfo.lastName ?? '',
            merchantClassificationCode: '5311',
            middleName:     accountInfo.middleName ?? '',
            type:           'PERSON',
            supportedCurrencies: accountInfo.currency ?? this.cbsConfig.CURRENCY,
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

    // Build request
        const requestBody: TCbsFeeRequest = {
            amount:                     quoteRequest.amount,
            currency:                   this.cbsConfig.CURRENCY,
            transactionType:            quoteRequest.transactionType, // e.g. "TRANSFER"
            sourceAccountNumber:        quoteRequest.from.idValue,
            destinationAccountNumber:   quoteRequest.to?.idValue,
            transactionId:              quoteRequest.transactionId,
            quoteId :                   quoteRequest.quoteId,
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        

        const response = await this.httpClient.post<
            TCbsFeeRequest,
            TCbsBaseResponse<TCbsFeeResponse>
        >(
            `${process.env.BLUE_BANK_URL}/transaction/lookup`,
            requestBody,
            { headers },
        );
 
        const cbsResponse = response.data;

        this.logger.info(`CBS tx lookup response: ${JSON.stringify(cbsResponse)}`);

        // Check for CBS-level errors
        if (cbsResponse.status !== 'success' || cbsResponse.statusCode !== '200') {
            this.logger.error(`CBS tx fee lookup failed: ${cbsResponse.errorText}`);
            throw ConnectorError.cbsConfigUndefined(
                cbsResponse.errorText ?? 'Fee lookup failed',
                cbsResponse.statusCode ?? '500',
                500,
            );
        }

        const txInfo = cbsResponse.information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No fee data returned', '2000', 500);
        }

    const QuoteResponse = {
            payeeFspCommissionAmountCurrency:   txInfo.transactionCurrency,
            payeeFspFeeAmount:                  txInfo.feeAmount,
            payeeFspFeeAmountCurrency:          txInfo.feeCurrency ?? this.cbsConfig.CURRENCY,
            payeeReceiveAmount:                 txInfo.transactionAmount,
            payeeReceiveAmountCurrency:         txInfo.transactionCurrency ?? this.cbsConfig.CURRENCY,
            quoteId:                            txInfo.quoteId,
            transactionId:                      txInfo.transactionId,
            transferAmount:                     quoteRequest.amount,
            transferAmountCurrency:             txInfo.feeCurrency ?? this.cbsConfig.CURRENCY,
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
        

        const response = await this.httpClient.post<
            TCbsReserveRequest,
            TCbsBaseResponse<TCbsReserveResponse>
        >(
            `${process.env.BLUE_BANK_URL}/transaction/athorise`,
            requestBody,
            { headers },
        );
 
        const cbsResponse = response.data;

        this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

        // Check for CBS-level errors
        if (cbsResponse.status !== 'success' || cbsResponse.statusCode !== '200') {
            this.logger.error(`CBS tx reserved failed: ${cbsResponse.errorText}`);
            throw ConnectorError.cbsConfigUndefined(
                cbsResponse.errorText ?? 'Reseved  failed',
                cbsResponse.statusCode ?? '500',
                500,
            );
        }

        const txInfo = cbsResponse.information;
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
            transactionId:               transferUpdate.transferId,
            PSPReference:                transferUpdate.homeTransactionId
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        

        const response = await this.httpClient.post<
            TCbsUnReserveRequest,
            TCbsBaseResponse<TCbsUnReserveResponse>
        >(
            `${process.env.BLUE_BANK_URL}/transaction/cancel`,
            requestBody,
            { headers },
        );
 
        const cbsResponse = response.data;

        this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

        // Check for CBS-level errors
        if (cbsResponse.status !== 'success' || cbsResponse.statusCode !== '200') {
            this.logger.error(`CBS tx reserved failed: ${cbsResponse.errorText}`);
            throw ConnectorError.cbsConfigUndefined(
                cbsResponse.errorText ?? 'Reseved  failed',
                cbsResponse.statusCode ?? '500',
                500,
            );
        }

        const txInfo = cbsResponse.information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No data returned', '2000', 500);
        }

         if (txInfo.status != 'SUCCESS') {
            throw ConnectorError.cbsConfigUndefined(txInfo?.message ?? 'unreserved failed', '2000', 500);
        }

        return ;
    }

    async commitReservedFunds(transferUpdate: TtransferPatchNotificationRequest): Promise<void> {
        this.logger.info(`Committing funds for request `, transferUpdate);

        // Build request
        const requestBody: TCbsPostingRequest = {
            transferId:                     transferUpdate.transferId,
            switchReference:                transferUpdate.homeTransactionId,
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        

        const response = await this.httpClient.post<
            TCbsPostingRequest,
            TCbsBaseResponse<TCbsUnReserveResponse>
        >(
            `${process.env.BLUE_BANK_URL}/transaction/capture`,
            requestBody,
            { headers },
        );
 
        const cbsResponse = response.data;

        this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

        // Check for CBS-level errors
        if (cbsResponse.status !== 'success' || cbsResponse.statusCode !== '200') {
            this.logger.error(`CBS tx reserved failed: ${cbsResponse.errorText}`);
            throw ConnectorError.cbsConfigUndefined(
                cbsResponse.errorText ?? 'Reseved  failed',
                cbsResponse.statusCode ?? '500',
                500,
            );
        }

        const txInfo = cbsResponse.information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No data returned', '2000', 500);
        }

        if (txInfo.status != 'SUCCESS') {
            throw ConnectorError.cbsConfigUndefined(txInfo?.message ?? 'commit transaction failed', '2000', 500);
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
            transferId:              transferId,
            switchReference :      updateSendMoneyDeps.homeTransactionId
        };

        const headers = this.getHeaders();
        this.logger.info(`CBS request body: ${JSON.stringify(requestBody)}`);
        

        const response = await this.httpClient.post<
            TCbsReversalRequest,
            TCbsBaseResponse<TCbsReversalResponse>
        >(
            `${process.env.BLUE_BANK_URL}/transaction/refund`,
            requestBody,
            { headers },
        );
 
        const cbsResponse = response.data;

        this.logger.info(`CBS tx reserve response: ${JSON.stringify(cbsResponse)}`);

        // Check for CBS-level errors
        if (cbsResponse.status !== 'success' || cbsResponse.statusCode !== '200') {
            this.logger.error(`CBS tx reserved failed: ${cbsResponse.errorText}`);
            throw ConnectorError.cbsConfigUndefined(
                cbsResponse.errorText ?? 'Reseved  failed',
                cbsResponse.statusCode ?? '500',
                500,
            );
        }

        const txInfo = cbsResponse.information;
        if (!txInfo) {
            throw ConnectorError.cbsConfigUndefined('No data returned', '2000', 500);
        }

         if (txInfo.status != 'SUCCESS') {
            throw ConnectorError.cbsConfigUndefined(txInfo?.message ?? 'refund transaction failed', '2000', 500);
        }


        this.logger.debug('transferResponse', 'REFUND COMPLETED');
        return;
    }
}

