import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, supabaseAuth } from '../config/supabase';
import { User } from '../types';

export interface AuthenticatedUser extends User {
  supabase_user: SupabaseUser;
}

export class AuthService {
  /**
   * Validate Supabase JWT token and return user information
   */
  async validateSupabaseToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      // Set the auth token for this request
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }

      // Get additional user information from our database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        // If user doesn't exist in our users table, create a basic user record
        const newUser: Partial<User> = {
          id: user.id,
          email: user.email || '',
          username: user.user_metadata?.['username'] || user.email?.split('@')[0],
          role: 'client', // Default role
        };

        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();

        if (createError) {
          console.error('Error creating user record:', createError);
          return null;
        }

        return {
          ...createdUser,
          supabase_user: user,
        } as AuthenticatedUser;
      }

      return {
        ...userData,
        supabase_user: user,
      } as AuthenticatedUser;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  /**
   * Get user role (client/vendor) from database
   */
  async getUserRole(userId: string): Promise<'client' | 'vendor'> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return 'client'; // Default to client if not found
      }

      return data.role as 'client' | 'vendor';
    } catch (error) {
      console.error('Error getting user role:', error);
      return 'client';
    }
  }

  /**
   * Update user role in database
   */
  async updateUserRole(userId: string, role: 'client' | 'vendor'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);

      return !error;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  }

  /**
   * Check if user is a vendor
   */
  async isVendor(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === 'vendor';
  }

  /**
   * Check if user is a client
   */
  async isClient(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === 'client';
  }

  /**
   * Get user by ID with full information
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();