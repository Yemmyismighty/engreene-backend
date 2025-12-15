import { BaseRepository } from './BaseRepository';
import { VendorAutoResponse } from '../../types';
import { db } from '../connection';

export class VendorAutoResponseRepository extends BaseRepository<VendorAutoResponse> {
  constructor() {
    super('vendor_auto_responses');
  }

  /**
   * Get active auto-response for a vendor
   */
  async getActiveResponse(vendorId: string): Promise<VendorAutoResponse | null> {
    const [response] = await db.query<VendorAutoResponse>(
      `SELECT * FROM vendor_auto_responses 
       WHERE vendor_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [vendorId]
    );
    return response || null;
  }

  /**
   * Set auto-response for a vendor (deactivates previous ones)
   */
  async setAutoResponse(vendorId: string, message: string): Promise<VendorAutoResponse> {
    // Start transaction to ensure atomicity
    await db.query('BEGIN');
    
    try {
      // Deactivate existing auto-responses
      await db.query(
        `UPDATE vendor_auto_responses 
         SET is_active = false 
         WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      );
      
      // Create new active auto-response
      const [response] = await db.query<VendorAutoResponse>(
        `INSERT INTO vendor_auto_responses (vendor_id, message, is_active)
         VALUES ($1, $2, true)
         RETURNING *`,
        [vendorId, message]
      );
      
      await db.query('COMMIT');
      return response!;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Deactivate auto-response for a vendor
   */
  async deactivateAutoResponse(vendorId: string): Promise<void> {
    await db.query(
      `UPDATE vendor_auto_responses 
       SET is_active = false 
       WHERE vendor_id = $1 AND is_active = true`,
      [vendorId]
    );
  }

  /**
   * Get all auto-responses for a vendor (including inactive)
   */
  async getVendorResponses(vendorId: string): Promise<VendorAutoResponse[]> {
    const responses = await db.query<VendorAutoResponse>(
      `SELECT * FROM vendor_auto_responses 
       WHERE vendor_id = $1
       ORDER BY created_at DESC`,
      [vendorId]
    );
    return responses;
  }
}