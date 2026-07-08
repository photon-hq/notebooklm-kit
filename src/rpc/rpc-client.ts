/**
 * RPC client for NotebookLM
 * Wraps the batch execute client with NotebookLM-specific configuration
 */

import { BatchExecuteClient } from '../utils/batch-execute.js';
import type { BatchExecuteConfig, RPCCall, RPCResponse } from '../types/common.js';
import type { TransportLocaleSettings } from '../types/common.js';
import { normalizeHeaderKeys, normalizeLocaleTag, resolveTransportLocaleSettings } from '../utils/locale.js';

/**
 * RPC client configuration
 */
export interface RPCClientConfig {
  authToken: string;
  cookies: string;
  debug?: boolean;
  authUser?: string;
  locale?: string;
  headers?: Record<string, string>;
  urlParams?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number;
  retryMaxDelay?: number;
}

function primaryAcceptLanguageLocale(acceptLanguage?: string): string | null {
  const primary = acceptLanguage?.split(',')[0]?.split(';')[0]?.trim();
  return normalizeLocaleTag(primary);
}

function hasOwnValue(record: Record<string, string> | undefined, key: string): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
}

function resolveActualTransportLocaleSettings(
  resolvedLocale: TransportLocaleSettings,
  batchConfig: BatchExecuteConfig,
  normalizedHeaders: Record<string, string>,
  configUrlParams?: Record<string, string>
): TransportLocaleSettings {
  const hl = batchConfig.urlParams['hl'] || resolvedLocale.hl;
  const acceptLanguage = batchConfig.headers['accept-language'] || resolvedLocale.acceptLanguage;
  const hasHlOverride = hasOwnValue(configUrlParams, 'hl');
  const hasAcceptLanguageOverride = hasOwnValue(normalizedHeaders, 'accept-language');

  let effectiveLocale = resolvedLocale.effectiveLocale;
  if (hasAcceptLanguageOverride) {
    effectiveLocale = primaryAcceptLanguageLocale(acceptLanguage) || normalizeLocaleTag(hl) || resolvedLocale.effectiveLocale;
  } else if (hasHlOverride) {
    effectiveLocale = normalizeLocaleTag(hl) || resolvedLocale.effectiveLocale;
  }

  return {
    effectiveLocale,
    localeSource: hasHlOverride || hasAcceptLanguageOverride ? 'config' : resolvedLocale.localeSource,
    hl,
    acceptLanguage,
  };
}

/**
 * NotebookLM RPC client
 */
export class RPCClient {
  private batchClient: BatchExecuteClient;
  private config: RPCClientConfig;
  private transportLocaleSettings: TransportLocaleSettings;
  
  constructor(config: RPCClientConfig) {
    this.config = config;

    const resolvedLocale = resolveTransportLocaleSettings({
      requestedLocale: config.locale,
    });
    const normalizedHeaders = normalizeHeaderKeys(config.headers);
    
    // Build batch execute config
    const batchConfig: BatchExecuteConfig = {
      host: 'notebooklm.google.com',
      app: 'LabsTailwindUi',
      authToken: config.authToken,
      cookies: config.cookies,
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'origin': 'https://notebooklm.google.com',
        'referer': 'https://notebooklm.google.com/',
        'x-same-domain': '1',
        'accept': '*/*',
        'accept-language': resolvedLocale.acceptLanguage,
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        ...normalizedHeaders,
      },
      urlParams: {
        // Stale fallback values — overridden at runtime by page-metadata extraction
        // in NotebookLMClient.connect(). Kept here as last-resort defaults.
        'bl': 'boq_labs-tailwind-frontend_20250129.00_p0',
        'f.sid': '-7121977511756781186',
        'hl': resolvedLocale.hl,
        'authuser': config.authUser || '0',
        ...config.urlParams,
      },
      debug: config.debug,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      retryMaxDelay: config.retryMaxDelay,
    };

    this.transportLocaleSettings = resolveActualTransportLocaleSettings(
      resolvedLocale,
      batchConfig,
      normalizedHeaders,
      config.urlParams
    );
    
    this.batchClient = new BatchExecuteClient(batchConfig);
  }
  
  /**
   * Update cookies (called when credentials are refreshed)
   */
  updateCookies(cookies: string): void {
    this.config.cookies = cookies;
    // Update batch client cookies
    this.batchClient.updateCookies(cookies);
  }
  
  /**
   * Get current cookies
   */
  getCookies(): string {
    return this.config.cookies;
  }
  
  /**
   * Execute an RPC call
   */
  async call(rpcId: string, args: any[], notebookId?: string): Promise<any> {
    // Create request-specific URL parameters
    const urlParams: Record<string, string> = {};
    
    if (notebookId) {
      urlParams['source-path'] = `/notebook/${notebookId}`;
    } else {
      urlParams['source-path'] = '/';
    }
    
    const rpcCall: RPCCall = {
      id: rpcId,
      args,
      notebookId,
      urlParams,
    };
    
    const response = await this.batchClient.do(rpcCall);
    
    return response.data;
  }
  
  /**
   * Get the underlying batch client
   */
  getBatchClient(): BatchExecuteClient {
    return this.batchClient;
  }
  
  /**
   * Get the current configuration
   */
  getConfig(): RPCClientConfig {
    return { ...this.config };
  }

  /**
   * Get resolved transport locale settings used for requests.
   */
  getTransportLocaleSettings(): TransportLocaleSettings {
    return { ...this.transportLocaleSettings };
  }
}
