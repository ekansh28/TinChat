
// ===================================================================
// server/config/xata.ts - NEW FILE FOR XATA INTEGRATION
import { logger } from '../utils/logger';

// Simple HTTP client for Xata REST API
class XataClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(databaseUrl: string, apiKey: string) {
    this.baseUrl = databaseUrl;
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xata API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  // User profiles table operations
  async getUserProfile(id: string) {
    try {
      return await this.request(`/tables/user_profiles/data/${id}`);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null; // Profile not found
      }
      throw error;
    }
  }

  async createUserProfile(id: string, data: any) {
    return await this.request(`/tables/user_profiles/data`, {
      method: 'POST',
      body: JSON.stringify({ id, ...data }),
    });
  }

  async updateUserProfile(id: string, data: any) {
    return await this.request(`/tables/user_profiles/data/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteUserProfile(id: string) {
    return await this.request(`/tables/user_profiles/data/${id}`, {
      method: 'DELETE',
    });
  }

  async searchUserProfiles(searchTerm: string, limit: number = 20) {
    const filter = {
      "$any": [
        { "username": { "$iContains": searchTerm } },
        { "display_name": { "$iContains": searchTerm } }
      ]
    };

    return await this.request('/tables/user_profiles/query', {
      method: 'POST',
      body: JSON.stringify({
        filter,
        page: { size: limit }
      }),
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/tables/user_profiles/schema');
      return true;
    } catch (error) {
      logger.error('Xata connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
let xataClient: XataClient | null = null;

export function initializeXata(): XataClient | null {
  const databaseUrl = process.env.XATA_DB_URL;
  const apiKey = process.env.XATA_API_KEY;

  if (!databaseUrl || !apiKey) {
    logger.error('❌ Missing Xata environment variables:', {
      hasDatabaseUrl: !!databaseUrl,
      hasApiKey: !!apiKey
    });
    return null;
  }

  try {
    xataClient = new XataClient(databaseUrl, apiKey);
    logger.info('✅ Xata client initialized successfully');
    return xataClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Xata client:', error);
    return null;
  }
}

export function getXataClient(): XataClient | null {
  return xataClient;
}