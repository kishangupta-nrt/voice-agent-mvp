import { getSupabaseClient } from '../../repositories/chat.repository';

export interface Customer {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  created_at: string;
}

export class CustomerService {
  async findByPhone(phone: string): Promise<Customer | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const cleanedPhone = phone.replace(/[^\d+]/g, '');

    try {
      const { data, error } = await client
        .from('customers')
        .select('*')
        .ilike('phone', `%${cleanedPhone.slice(-10)}`)
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data as Customer;
    } catch {
      return null;
    }
  }

  async create(phone: string, email?: string, name?: string): Promise<Customer | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('customers')
        .insert({ phone, email, name })
        .select()
        .single();

      if (error) {
        console.error('Customer creation error:', error);
        return null;
      }

      return data as Customer;
    } catch {
      return null;
    }
  }

  async findById(id: string): Promise<Customer | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return data as Customer;
    } catch {
      return null;
    }
  }
}