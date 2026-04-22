# Voice Agent MVP - Database Schema

## Run this in Supabase SQL Editor

```sql
-- Add user_id to conversations (for RLS ownership)
ALTER TABLE conversations ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Add user_id to messages (performance + security)
ALTER TABLE messages ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Drop old open policies
DROP POLICY IF EXISTS "Allow all for now" ON conversations;
DROP POLICY IF EXISTS "Allow all for now" ON messages;

-- RLS policies with WITH CHECK (enforces ownership on reads AND writes)
CREATE POLICY "Users own conversations" 
ON conversations FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own messages" 
ON messages FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

## Full Table Definitions

```sql
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Row Level Security (RLS) - Enable for production
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (enforce ownership)
CREATE POLICY "Users own conversations" 
ON conversations FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own messages" 
ON messages FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

## CUSTOMER HANDLING TABLES (NEW)

```sql
-- Customers table (for phone verification - NOT linked to auth.users for public voice calls)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table  
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  status VARCHAR(50) DEFAULT 'pending',
  items JSONB,
  total DECIMAL(10,2),
  shipping_address TEXT,
  tracking_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  issue_type VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Callbacks scheduling
CREATE TABLE IF NOT EXISTS callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_callbacks_customer_id ON callbacks(customer_id);

-- RLS Policies - Service role manages access
-- (Server uses service_role key - these policies control what SERVER exposes)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE callbacks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated access for read operations via server
CREATE POLICY "Service role customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Service role orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Service role tickets" ON tickets FOR SELECT USING (true);
CREATE POLICY "Service role callbacks" ON callbacks FOR SELECT USING (true);

-- Allow insert/update via service role only (not directly from clients)
CREATE POLICY "Service role customers_insert" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role customers_update" ON customers FOR UPDATE USING (true);
CREATE POLICY "Service role orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role orders_update" ON orders FOR UPDATE USING (true);
CREATE POLICY "Service role tickets_insert" ON tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role tickets_update" ON tickets FOR UPDATE USING (true);
CREATE POLICY "Service role callbacks_insert" ON callbacks FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role callbacks_update" ON callbacks FOR UPDATE USING (true);
```

## Sample Data (For Testing)

```sql
-- Insert sample customer
INSERT INTO customers (phone, email, name) 
VALUES ('+1234567890', 'john@example.com', 'John Doe');

-- Insert sample order
INSERT INTO orders (order_number, customer_id, status, items, total)
SELECT 'ORD-001', id, 'shipped', '[{"name": "Product A", "qty": 2}]', 99.99
FROM customers WHERE phone = '+1234567890';

-- Insert sample ticket
INSERT INTO tickets (customer_id, issue_type, description, priority)
SELECT id, 'billing', 'Question about charge', 'low'
FROM customers WHERE phone = '+1234567890';
```

## Alternative: PostgreSQL Syntax for local DB

```sql
-- conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER,
  role VARCHAR(20) CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
```