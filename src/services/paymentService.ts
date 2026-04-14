import { supabase } from './supabase';

// Stripe types (you'll need to install @stripe/stripe-js)
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  artist: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paymentIntentId?: string;
  shippingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderData {
  items: OrderItem[];
  total: number;
  shippingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export class PaymentService {
  // Create a payment intent with Stripe
  static async createPaymentIntent(amount: number, sellerStripeAccountId: string, currency: string = 'usd'): Promise<PaymentIntent> {
    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency,
          sellerStripeAccountId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      
      // Return the expected PaymentIntent format
      return {
        id: data.id || 'pi_temp_' + Date.now(),
        amount: amount,
        currency: currency,
        status: 'requires_payment_method',
        client_secret: data.clientSecret
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Create an order in the database
  static async createOrder(data: CreateOrderData): Promise<Order> {
    try {
      const { data: order, error } = await supabase
        .from('orders' as any)
        .insert([{
          user_id: (await supabase.auth.getUser()).data.user?.id,
          items: data.items,
          total: data.total,
          status: 'pending',
          shipping_address: data.shippingAddress,
        }])
        .select()
        .single();

      if (error) {
        // If table doesn't exist yet, return mock order
        if (error.message.includes('does not exist')) {
          console.warn('Orders table does not exist yet. Please run the database schema.');
          return {
            id: 'temp-' + Date.now(),
            userId: (await supabase.auth.getUser()).data.user?.id || '',
            items: data.items,
            total: data.total,
            status: 'pending',
            shippingAddress: data.shippingAddress,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        throw new Error(`Failed to create order: ${error.message}`);
      }

      return this.mapDatabaseOrderToOrder(order);
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Update order with payment intent
  static async updateOrderWithPayment(orderId: string, paymentIntentId: string): Promise<Order> {
    try {
      const { data: order, error } = await supabase
        .from('orders' as any)
        .update({ payment_intent_id: paymentIntentId })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update order: ${error.message}`);
      }

      return this.mapDatabaseOrderToOrder(order);
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  // Update order status
  static async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    try {
      const { data: order, error } = await supabase
        .from('orders' as any)
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update order status: ${error.message}`);
      }

      return this.mapDatabaseOrderToOrder(order);
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Get user's orders
  static async getUserOrders(): Promise<Order[]> {
    try {
      const { data: orders, error } = await supabase
        .from('orders' as any)
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist yet, return empty array
        if (error.message.includes('does not exist')) {
          console.warn('Orders table does not exist yet. Please run the database schema.');
          return [];
        }
        throw new Error(`Failed to fetch orders: ${error.message}`);
      }

      return orders.map(order => this.mapDatabaseOrderToOrder(order));
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  }

  // Get order by ID
  static async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const { data: order, error } = await supabase
        .from('orders' as any)
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch order: ${error.message}`);
      }

      return this.mapDatabaseOrderToOrder(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  // Process payment with Stripe
  static async processPayment(paymentIntentId: string, orderId: string): Promise<boolean> {
    try {
      // In a real implementation, you would confirm the payment with Stripe
      // For now, we'll simulate a successful payment
      await this.updateOrderStatus(orderId, 'completed');
      return true;
    } catch (error) {
      console.error('Error processing payment:', error);
      await this.updateOrderStatus(orderId, 'failed');
      return false;
    }
  }

  // Helper function to map database order to Order interface
  private static mapDatabaseOrderToOrder(dbOrder: any): Order {
    return {
      id: dbOrder.id,
      userId: dbOrder.user_id,
      items: dbOrder.items || [],
      total: dbOrder.total,
      status: dbOrder.status,
      paymentIntentId: dbOrder.payment_intent_id,
      shippingAddress: dbOrder.shipping_address,
      createdAt: new Date(dbOrder.created_at),
      updatedAt: new Date(dbOrder.updated_at),
    };
  }
} 