import { getSupabaseClient } from '../../repositories/chat.repository';

export interface Callback {
  id: string;
  customer_id: string;
  scheduled_time: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export class CallbackService {
  async schedule(
    customerId: string,
    scheduledTime: Date,
    notes?: string
  ): Promise<Callback | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('callbacks')
        .insert({
          customer_id: customerId,
          scheduled_time: scheduledTime.toISOString(),
          notes: notes || null,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) {
        console.error('Callback scheduling error:', error);
        return null;
      }

      return data as Callback;
    } catch {
      return null;
    }
  }

  async findByCustomerId(customerId: string, limit = 10): Promise<Callback[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('callbacks')
        .select('*')
        .eq('customer_id', customerId)
        .order('scheduled_time', { ascending: true })
        .limit(limit);

      if (error) {
        return [];
      }

      return (data || []) as Callback[];
    } catch {
      return [];
    }
  }

  async cancel(callbackId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from('callbacks')
        .update({ status: 'cancelled' })
        .eq('id', callbackId);

      return !error;
    } catch {
      return false;
    }
  }

  formatScheduledTime(callback: Callback): string {
    const date = new Date(callback.scheduled_time);
    return `Your callback is scheduled for ${date.toLocaleString()}.`;
  }
}