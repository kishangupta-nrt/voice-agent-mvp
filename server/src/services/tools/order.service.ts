import { getSupabaseClient } from '../../repositories/chat.repository';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: string;
  items: any;
  total: number | null;
  shipping_address: string | null;
  tracking_number: string | null;
  created_at: string;
}

export class OrderService {
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

      if (error || !data) {
        return null;
      }

      return data as Order;
    } catch {
      return null;
    }
  }

  async findByCustomerId(customerId: string, limit = 5): Promise<Order[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return [];
      }

      return (data || []) as Order[];
    } catch {
      return [];
    }
  }

  async getOrderStatus(orderNumber: string): Promise<string | null> {
    const order = await this.findByOrderNumber(orderNumber);
    return order?.status || null;
  }

  formatOrderStatus(order: Order): string {
    const status_map: Record<string, string> = {
      pending: 'is being processed',
      shipped: 'has been shipped',
      delivered: 'has been delivered',
      cancelled: 'was cancelled',
    };

    const statusText = status_map[order.status] || `is ${order.status}`;
    const tracking = order.tracking_number ? ` Tracking number: ${order.tracking_number}.` : '';
    
    return `Your order ${order.order_number} ${statusText}.${tracking}`;
  }
}