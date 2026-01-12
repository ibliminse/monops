/**
 * Marketplace Adapter Interface
 * Defines the contract for marketplace integrations
 */

export interface FloorPrice {
  price: bigint;
  currency: string;
  source: string;
  timestamp: number;
}

export interface Listing {
  id: string;
  collectionAddress: string;
  tokenId: string;
  seller: string;
  price: bigint;
  currency: string;
  expiresAt?: number;
  marketplace: string;
}

export interface CreateListingParams {
  collectionAddress: string;
  tokenId: string;
  price: bigint;
  currency: string;
  expiresAt?: number;
}

export interface CollectionOffer {
  id: string;
  collectionAddress: string;
  bidder: string;
  price: bigint;
  currency: string;
  quantity: number;
  expiresAt?: number;
  marketplace: string;
}

export interface CreateOfferParams {
  collectionAddress: string;
  price: bigint;
  currency: string;
  quantity: number;
  expiresAt?: number;
}

/**
 * Abstract marketplace adapter interface
 */
export interface MarketplaceAdapter {
  readonly name: string;
  readonly supportedChainIds: number[];

  /**
   * Get the floor price for a collection
   */
  getFloor(collectionAddress: string): Promise<FloorPrice | null>;

  /**
   * Get active listings for a wallet, optionally filtered by collection
   */
  getListings(walletAddress: string, collectionAddress?: string): Promise<Listing[]>;

  /**
   * Get listings for a specific collection
   */
  getCollectionListings(collectionAddress: string, limit?: number): Promise<Listing[]>;

  /**
   * Create a listing (requires wallet signature)
   */
  createListing(params: CreateListingParams): Promise<{ success: boolean; listingId?: string; error?: string }>;

  /**
   * Cancel a listing
   */
  cancelListing(listingId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Get collection offers
   */
  getCollectionOffers(collectionAddress: string): Promise<CollectionOffer[]>;

  /**
   * Create a collection offer
   */
  createCollectionOffer(params: CreateOfferParams): Promise<{ success: boolean; offerId?: string; error?: string }>;

  /**
   * Cancel a collection offer
   */
  cancelOffer(offerId: string): Promise<{ success: boolean; error?: string }>;
}

/**
 * Stub adapter that returns mock data
 * Used for development and testing
 */
export class StubMarketplaceAdapter implements MarketplaceAdapter {
  readonly name = 'Stub Marketplace';
  readonly supportedChainIds = [143]; // Monad mainnet

  async getFloor(collectionAddress: string): Promise<FloorPrice | null> {
    // Return mock floor price
    return {
      price: BigInt('1000000000000000000'), // 1 MON
      currency: 'MON',
      source: 'stub',
      timestamp: Date.now(),
    };
  }

  async getListings(walletAddress: string, collectionAddress?: string): Promise<Listing[]> {
    // Return empty listings (no mock data for wallet-specific queries)
    return [];
  }

  async getCollectionListings(collectionAddress: string, limit = 10): Promise<Listing[]> {
    // Return mock listings
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: `stub-listing-${i}`,
      collectionAddress,
      tokenId: (i + 1).toString(),
      seller: '0x0000000000000000000000000000000000000001',
      price: BigInt((i + 1) * 1e18),
      currency: 'MON',
      marketplace: 'stub',
    }));
  }

  async createListing(params: CreateListingParams): Promise<{ success: boolean; listingId?: string; error?: string }> {
    // TODO: Implement actual marketplace integration
    return {
      success: false,
      error: 'Stub adapter does not support creating listings. Implement a real marketplace adapter.',
    };
  }

  async cancelListing(listingId: string): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement actual marketplace integration
    return {
      success: false,
      error: 'Stub adapter does not support canceling listings. Implement a real marketplace adapter.',
    };
  }

  async getCollectionOffers(collectionAddress: string): Promise<CollectionOffer[]> {
    // Return mock offers
    return [
      {
        id: 'stub-offer-1',
        collectionAddress,
        bidder: '0x0000000000000000000000000000000000000002',
        price: BigInt('500000000000000000'), // 0.5 MON
        currency: 'MON',
        quantity: 10,
        marketplace: 'stub',
      },
    ];
  }

  async createCollectionOffer(params: CreateOfferParams): Promise<{ success: boolean; offerId?: string; error?: string }> {
    // TODO: Implement actual marketplace integration
    return {
      success: false,
      error: 'Stub adapter does not support creating offers. Implement a real marketplace adapter.',
    };
  }

  async cancelOffer(offerId: string): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement actual marketplace integration
    return {
      success: false,
      error: 'Stub adapter does not support canceling offers. Implement a real marketplace adapter.',
    };
  }
}

// TODO: Implement OpenSeaAdapter
// export class OpenSeaAdapter implements MarketplaceAdapter {
//   readonly name = 'OpenSea';
//   readonly supportedChainIds = [143];
//   private apiKey: string;
//
//   constructor(apiKey: string) {
//     this.apiKey = apiKey;
//   }
//
//   async getFloor(collectionAddress: string): Promise<FloorPrice | null> {
//     // Implement OpenSea API call
//   }
//   // ... rest of implementation
// }

// TODO: Implement MagicEdenAdapter
// export class MagicEdenAdapter implements MarketplaceAdapter {
//   readonly name = 'Magic Eden';
//   readonly supportedChainIds = [143];
//   private apiKey: string;
//
//   constructor(apiKey: string) {
//     this.apiKey = apiKey;
//   }
//
//   async getFloor(collectionAddress: string): Promise<FloorPrice | null> {
//     // Implement Magic Eden API call
//   }
//   // ... rest of implementation
// }

/**
 * Get the active marketplace adapter
 * For now, returns the stub adapter
 */
export function getMarketplaceAdapter(): MarketplaceAdapter {
  // TODO: Return real adapter based on config
  return new StubMarketplaceAdapter();
}
