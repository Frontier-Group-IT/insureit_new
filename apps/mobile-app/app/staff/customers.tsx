import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppSearchBar } from '@/components/design-system';
import { Button, EmptyState, LoadingState, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { Customer } from '@/lib/types';

export default function CustomerSearchScreen() {
  const pageSize = 12;
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const term = query.trim();
    let request = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('contact_name', { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (term) {
      const pattern = `%${term}%`;
      request = request.or(`contact_name.ilike.${pattern},phone.ilike.${pattern},customer_code.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern}`);
    }

    const { data, count } = await request;
    setCustomers(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Screen title="Customers" subtitle={`${total} customer${total === 1 ? '' : 's'}`} showLogout>
      <AppSearchBar value={query} onChangeText={updateQuery} placeholder="Search name or mobile number" />
      {loading ? <LoadingState label="Loading customers" /> : null}
      {!loading && customers.length === 0 ? <EmptyState title="No customers found" body="Try another name, mobile number, company, or code." /> : customers.map((customer) => (
        <View key={customer.id} style={styles.customerRow}>
          <View style={styles.customerIcon}>
            <MaterialCommunityIcons name="account-box-outline" size={20} color={palette.blue} />
          </View>
          <View style={styles.customerCopy}>
            <Text style={styles.customerName} numberOfLines={1}>{customer.contact_name || customer.company_name || 'Customer'}</Text>
            <Text style={styles.customerMeta} numberOfLines={1}>{customer.company_name || customer.customer_code}</Text>
            <Text style={styles.customerMeta} numberOfLines={1}>{customer.phone || customer.email || '-'}</Text>
          </View>
          <Text style={styles.customerCode}>{customer.customer_code}</Text>
        </View>
      ))}
      {!loading && total > pageSize ? (
        <View style={styles.pagination}>
          <Button label="Previous" variant="secondary" disabled={page === 0} onPress={() => setPage((current) => Math.max(0, current - 1))} />
          <Text style={styles.pageText}>Page {page + 1} of {pageCount}</Text>
          <Button label="Next" variant="secondary" disabled={page + 1 >= pageCount} onPress={() => setPage((current) => Math.min(pageCount - 1, current + 1))} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, padding: 11, marginBottom: 8 },
  customerIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  customerCopy: { flex: 1, minWidth: 0 },
  customerName: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  customerMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 3 },
  customerCode: { color: palette.slate, fontSize: 11, fontWeight: '600', maxWidth: 92 },
  pagination: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pageText: { flex: 1, color: palette.slate, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
