import { CustomerService, Customer } from './customer.service';
import { OrderService } from './order.service';
import { TicketService } from './ticket.service';
import { CallbackService } from './callback.service';
import { Intent, detectIntent } from '../../knowledge/intents';

export interface ExecutionResult {
  response: string;
  intent: Intent | null;
  customer?: Customer;
  requiresAuth: boolean;
  requiresSlots: string[];
  slotValues: Record<string, string>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

interface ToolParams {
  order_number?: string;
  issue_type?: string;
  description?: string;
  preferred_time?: string;
  notes?: string;
  phone?: string;
  [key: string]: string | undefined;
}

export const TOOLS = {
  lookup_order: {
    name: 'lookup_order',
    execute: async (slots: ToolParams, customer?: Customer): Promise<ToolResult> => {
      const orderNumber = slots.order_number;
      if (!orderNumber) {
        return { success: false, message: 'order_number required' };
      }

      const orderService = new OrderService();
      const order = await orderService.findByOrderNumber(orderNumber);
      if (!order) {
        return {
          success: false,
          message: 'I couldn\'t find that order. Can you double-check the order number?'
        };
      }

      return {
        success: true,
        message: orderService.formatOrderStatus(order),
        data: order
      };
    },
  },

  create_ticket: {
    name: 'create_ticket',
    execute: async (slots: ToolParams, customer?: Customer): Promise<ToolResult> => {
      if (!customer) {
        return {
          success: false,
          message: 'I\'ll need to verify your account first. What\'s your phone number?'
        };
      }

      const ticketService = new TicketService();
      const ticket = await ticketService.create(
        customer.id,
        slots.issue_type || 'general',
        slots.description || 'No description provided'
      );

      if (!ticket) {
        return {
          success: false,
          message: 'I apologize, but I couldn\'t create the ticket. Please try again.'
        };
      }

      return {
        success: true,
        message: 'I\'ve created a support ticket for you. Our team will be in touch soon. Is there anything else I can help with?',
        data: ticket
      };
    },
  },

  schedule_callback: {
    name: 'schedule_callback',
    execute: async (slots: ToolParams, customer?: Customer): Promise<ToolResult> => {
      if (!customer) {
        return {
          success: false,
          message: 'I\'ll need to verify your account first. What\'s your phone number?'
        };
      }

      const timeStr = slots.preferred_time;
      if (!timeStr) {
        return {
          success: false,
          message: 'What time works best for a callback?'
        };
      }

      const scheduledTime = new Date(timeStr);
      if (isNaN(scheduledTime.getTime())) {
        return {
          success: false,
          message: 'I didn\'t catch that time. What date and time would work for a callback?'
        };
      }

      const callbackService = new CallbackService();
      const callback = await callbackService.schedule(
        customer.id,
        scheduledTime,
        slots.notes
      );

      if (!callback) {
        return {
          success: false,
          message: 'I couldn\'t schedule that callback. Please try again.'
        };
      }

      return {
        success: true,
        message: `Your callback is scheduled. We'll call you at ${scheduledTime.toLocaleString()}. Is there anything else?`,
        data: callback
      };
    },
  },

  verify_customer: {
    name: 'verify_customer',
    execute: async (slots: ToolParams, _customer?: Customer): Promise<ToolResult> => {
      const phone = slots.phone;
      if (!phone) {
        return {
          success: false,
          message: 'What\'s your phone number?'
        };
      }

      const customerService = new CustomerService();
      const customer = await customerService.findByPhone(phone);
      if (!customer) {
        return {
          success: false,
          message: 'I don\'t have an account with that number. Can I create one for you?',
          data: null
        };
      }

      return {
        success: true,
        message: `Thanks ${customer.name || 'there'}! How can I help you today?`,
        data: customer
      };
    },
  },
};

export class ToolExecutor {
  async executeIntent(
    message: string,
    slots: Record<string, string> = {},
    customer?: Customer
  ): Promise<ExecutionResult> {
    const intent = detectIntent(message);

    if (!intent) {
      return {
        response: '',
        intent: null,
        customer,
        requiresAuth: false,
        requiresSlots: [],
        slotValues: slots,
      };
    }

    if (intent.requiresAuth && !customer) {
      return {
        response: intent.response,
        intent,
        customer: undefined,
        requiresAuth: true,
        requiresSlots: intent.slots || [],
        slotValues: slots,
      };
    }

    if (intent.tool && TOOLS[intent.tool as keyof typeof TOOLS]) {
      const tool = TOOLS[intent.tool as keyof typeof TOOLS];
      const toolSlots = slots as ToolParams;
      const result = await tool.execute(toolSlots, customer);

      return {
        response: result.message,
        intent,
        customer: result.data?.customer || customer,
        requiresAuth: false,
        requiresSlots: [],
        slotValues: slots,
      };
    }

    return {
      response: intent.response,
      intent,
      customer,
      requiresAuth: false,
      requiresSlots: intent.slots || [],
      slotValues: slots,
    };
  }
}