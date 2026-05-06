import { CustomerService, Customer } from './customer.service';
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
  data?: unknown;
}

interface ToolParams {
  phone?: string;
  email?: string;
  preferred_time?: string;
  [key: string]: string | undefined;
}

export const TOOLS = {
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
  async executeWithIntent(
    message: string,
    intent: Intent,
    slots: Record<string, string> = {},
    customer?: Customer
  ): Promise<ExecutionResult> {
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
        customer,
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
