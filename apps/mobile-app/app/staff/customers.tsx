import { useState } from 'react';

import { Button, Card, EmptyState, Row, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/lib/types';

export default function CustomerSearchScreen() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searched, setSearched] = useState(false);

  async function search() {
    setSearched(true);
    const term = `%${query.trim()}%`;
    const { data } = await supabase.from('customers').select('*').or(`contact_name.ilike.${term},phone.ilike.${term},customer_code.ilike.${term},company_name.ilike.${term}`).limit(25);
    setCustomers(data ?? []);
  }

  return (
    <Screen title="Customer Search" showLogout>
      <Card>
        <TextField label="Name, phone, company, or customer code" value={query} onChangeText={setQuery} />
        <Button label="Search customers" onPress={search} />
      </Card>
      {searched && customers.length === 0 ? <EmptyState title="No customers found" body="Try a different name, phone number, or customer code." /> : customers.map((customer) => (
        <Card key={customer.id}>
          <Row label="Customer" value={customer.contact_name} />
          <Row label="Company" value={customer.company_name} />
          <Row label="Phone" value={customer.phone} />
          <Row label="Code" value={customer.customer_code} />
        </Card>
      ))}
    </Screen>
  );
}
