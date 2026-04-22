import { getSupabaseClient } from '../../repositories/chat.repository';

export interface Ticket {
  id: string;
  customer_id: string;
  issue_type: string | null;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
}

export class TicketService {
  async create(
    customerId: string,
    issueType: string,
    description: string,
    priority = 'medium'
  ): Promise<Ticket | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('tickets')
        .insert({
          customer_id: customerId,
          issue_type: issueType,
          description: description,
          priority,
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        console.error('Ticket creation error:', error);
        return null;
      }

      return data as Ticket;
    } catch {
      return null;
    }
  }

  async findByCustomerId(customerId: string, limit = 10): Promise<Ticket[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('tickets')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return [];
      }

      return (data || []) as Ticket[];
    } catch {
      return [];
    }
  }

  async updateStatus(ticketId: string, status: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from('tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      return !error;
    } catch {
      return false;
    }
  }
}