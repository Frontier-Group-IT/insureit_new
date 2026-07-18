import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

export default function AddPolicyScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [insurerQuery, setInsurerQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [policyType, setPolicyType] = useState('Commercial comprehensive');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [dateTarget, setDateTarget] = useState<'start' | 'end' | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextContexts = await getOperationalCustomerContexts();
      const ids = nextContexts.map((context) => context.customer_id);
      const [vehicleResult, companyResult] = await Promise.all([
        ids.length ? supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no') : Promise.resolve({ data: [] as Vehicle[] }),
        supabase.from('insurance_companies').select('*').order('name'),
      ]);
      if (!active) return;
      const routeVehicle = vehicleId ? ((vehicleResult.data ?? []) as Vehicle[]).find((vehicle) => vehicle.id === vehicleId) : null;
      setContexts(nextContexts);
      setSelectedCustomerId(routeVehicle?.customer_id ?? nextContexts[0]?.customer_id ?? '');
      setVehicles((vehicleResult.data ?? []) as Vehicle[]);
      setCompanies(companyResult.data ?? []);
      if (routeVehicle) {
        setSelectedVehicleId(routeVehicle.id);
        setVehicleQuery(routeVehicle.vehicle_no);
      }
    }
    void load();
    return () => { active = false; };
  }, [router, vehicleId]);

  const accountVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.customer_id === selectedCustomerId), [selectedCustomerId, vehicles]);
  const filteredVehicles = useMemo(() => accountVehicles.filter((vehicle) => {
    const text = `${vehicle.vehicle_no} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.toLowerCase();
    return !vehicleQuery.trim() || text.includes(vehicleQuery.trim().toLowerCase());
  }).slice(0, 8), [accountVehicles, vehicleQuery]);
  const filteredCompanies = useMemo(() => companies.filter((company) => !insurerQuery.trim() || company.name.toLowerCase().includes(insurerQuery.trim().toLowerCase())).slice(0, 8), [companies, insurerQuery]);

  async function save() {
    setMessage('');
    if (saving) return;
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const target = contexts.find((context) => context.customer_id === selectedCustomerId);
    if (!target) return setMessage('Select the customer account for this policy.');
    if (!selectedVehicleId) return setMessage('Select a vehicle from the list.');
    if (!selectedCompanyId) return setMessage('Select an insurer from the list.');
    if (!policyNo.trim()) return setMessage('Enter policy number.');
    if (!startDate || !endDate) return setMessage('Select start and end dates.');
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) return setMessage('End date must be after start date.');
    const premiumValue = premium ? Number(premium) : null;
    if (premiumValue !== null && (!Number.isFinite(premiumValue) || premiumValue < 0)) return setMessage('Enter a valid premium amount.');

    setSaving(true);
    const { error } = await (supabase.rpc as any)('create_customer_policy', {
      p_customer_id: target.customer_id,
      p_vehicle_id: selectedVehicleId,
      p_insurance_company_id: selectedCompanyId,
      p_policy_no: policyNo.trim().toUpperCase(),
      p_policy_type: policyType.trim(),
      p_start_date: startDate,
      p_end_date: endDate,
      p_premium_amount: premiumValue,
    });
    setSaving(false);
    if (error) setMessage(error.message || 'We could not save this policy. Please try again.');
    else router.replace(contexts[0]?.partner_type === 'group' ? '/customer/group/policies' : '/customer/policies');
  }

  return (
    <Screen title="Add Policy" showLogout showTitleHeader={false}>
      <Text style={styles.compactTitle}>Add Policy</Text>
      <Card style={styles.formCard}>
        {message ? <Message type="error">{message}</Message> : null}
        {contexts.length > 1 ? <AccountDropdown contexts={contexts} selectedCustomerId={selectedCustomerId} open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} onSelect={(customerId) => { setSelectedCustomerId(customerId); setAccountOpen(false); setSelectedVehicleId(''); setVehicleQuery(''); }} /> : null}
        <VehiclePicker query={vehicleQuery} selectedVehicleId={selectedVehicleId} vehicles={filteredVehicles} onChange={setVehicleQuery} onSelect={(vehicle) => { setSelectedVehicleId(vehicle.id); setVehicleQuery(vehicle.vehicle_no); }} />
        <InsurerPicker query={insurerQuery} selectedCompanyId={selectedCompanyId} companies={filteredCompanies} onChange={setInsurerQuery} onSelect={(company) => { setSelectedCompanyId(company.id); setInsurerQuery(company.name); }} />
        <TextField label="Policy number" value={policyNo} onChangeText={(value) => setPolicyNo(value.toUpperCase())} autoCapitalize="characters" />
        <TextField label="Policy type" value={policyType} onChangeText={setPolicyType} />
        <View style={styles.dateRow}>
          <DateBox label="Start date" value={startDate} onPress={() => setDateTarget('start')} />
          <DateBox label="End date" value={endDate} onPress={() => setDateTarget('end')} />
        </View>
        <View style={styles.moneyField}>
          <Text style={styles.moneyLabel}>Premium amount</Text>
          <View style={styles.moneyShell}><Text style={styles.rupee}>₹</Text><TextInput value={premium} onChangeText={(value) => setPremium(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A94A6" style={styles.moneyInput} /></View>
        </View>
        <Button label={saving ? 'Saving policy...' : 'Save policy'} onPress={save} disabled={saving} />
        {saving ? <ActivityIndicator color={palette.navy} /> : null}
      </Card>
      <DatePickerModal visible={Boolean(dateTarget)} initialDate={(dateTarget === 'end' ? endDate : startDate) || today()} onClose={() => setDateTarget(null)} onSelect={(value) => { if (dateTarget === 'start') setStartDate(value); else setEndDate(value); setDateTarget(null); }} />
    </Screen>
  );
}

function AccountDropdown({ contexts, selectedCustomerId, open, onToggle, onSelect }: { contexts: CustomerAccountContext[]; selectedCustomerId: string; open: boolean; onToggle: () => void; onSelect: (customerId: string) => void }) {
  const selected = contexts.find((context) => context.customer_id === selectedCustomerId);
  return <View style={styles.accountBlock}><Text style={styles.accountLabel}>Add for</Text><Pressable onPress={onToggle} style={styles.dropdownButton}><View style={styles.accountCopy}><Text style={styles.accountTitle} numberOfLines={1}>{selected ? customerAccountTitle(selected) : 'Select customer'}</Text><Text style={styles.accountMeta}>{selected ? `${selected.access_source === 'group_child' ? 'Associated account' : 'Parent account'} - ${partnerTypeLabel(selected.partner_type)}` : 'Choose policy owner'}</Text></View><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={palette.navy} /></Pressable>{open ? <View style={styles.dropdownMenu}>{contexts.map((context) => { const active = context.customer_id === selectedCustomerId; return <Pressable key={context.customer_id} onPress={() => onSelect(context.customer_id)} style={[styles.dropdownItem, active && styles.dropdownItemActive]}><View style={styles.accountCopy}><Text style={[styles.accountTitle, active && styles.accountTitleActive]} numberOfLines={1}>{customerAccountTitle(context)}</Text><Text style={[styles.accountMeta, active && styles.accountMetaActive]}>{context.access_source === 'group_child' ? 'Associated account' : 'Parent account'} - {partnerTypeLabel(context.partner_type)}</Text></View>{active ? <MaterialCommunityIcons name="check-circle" size={19} color={palette.navy} /> : null}</Pressable>; })}</View> : null}</View>;
}

function VehiclePicker({ query, selectedVehicleId, vehicles, onChange, onSelect }: { query: string; selectedVehicleId: string; vehicles: Vehicle[]; onChange: (value: string) => void; onSelect: (vehicle: Vehicle) => void }) {
  return <View style={styles.selectorBlock}><Text style={styles.accountLabel}>Vehicle number</Text><View style={styles.searchShell}><MaterialCommunityIcons name="truck-outline" size={18} color="#0A43A3" /><TextInput value={query} onFocus={() => onChange(query)} onChangeText={(value) => onChange(value.toUpperCase())} autoCapitalize="characters" placeholder="Type or select vehicle" placeholderTextColor="#8A94A6" style={styles.searchInput} /></View><View style={styles.suggestionList}>{vehicles.length ? vehicles.map((vehicle) => <Pressable key={vehicle.id} onPress={() => onSelect(vehicle)} style={[styles.suggestionItem, selectedVehicleId === vehicle.id && styles.suggestionActive]}><View style={styles.accountCopy}><Text style={styles.suggestionTitle}>{vehicle.vehicle_no}</Text><Text style={styles.suggestionMeta}>{[vehicle.make, vehicle.model].filter(Boolean).join(' - ') || vehicle.vehicle_type}</Text></View>{selectedVehicleId === vehicle.id ? <MaterialCommunityIcons name="check-circle" size={18} color={palette.navy} /> : null}</Pressable>) : <Text style={styles.emptyHint}>No vehicles found for this account.</Text>}</View></View>;
}

function InsurerPicker({ query, selectedCompanyId, companies, onChange, onSelect }: { query: string; selectedCompanyId: string; companies: InsuranceCompany[]; onChange: (value: string) => void; onSelect: (company: InsuranceCompany) => void }) {
  return <View style={styles.selectorBlock}><Text style={styles.accountLabel}>Insurer</Text><View style={styles.searchShell}><MaterialCommunityIcons name="shield-check-outline" size={18} color="#0A43A3" /><TextInput value={query} onChangeText={onChange} placeholder="Search insurer" placeholderTextColor="#8A94A6" style={styles.searchInput} /></View><View style={styles.suggestionList}>{companies.map((company) => <Pressable key={company.id} onPress={() => onSelect(company)} style={[styles.suggestionItem, selectedCompanyId === company.id && styles.suggestionActive]}><Text style={styles.suggestionTitle} numberOfLines={1}>{company.name}</Text>{selectedCompanyId === company.id ? <MaterialCommunityIcons name="check-circle" size={18} color={palette.navy} /> : null}</Pressable>)}</View></View>;
}

function DateBox({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.dateBox}><Text style={styles.dateLabel}>{label}</Text><View style={styles.dateValueRow}><Text style={[styles.dateValue, !value && styles.datePlaceholder]}>{value || 'Select date'}</Text><MaterialCommunityIcons name="calendar-month-outline" size={18} color="#0A43A3" /></View></Pressable>;
}

function DatePickerModal({ visible, initialDate, onClose, onSelect }: { visible: boolean; initialDate: string; onClose: () => void; onSelect: (date: string) => void }) {
  const [cursor, setCursor] = useState(() => new Date(initialDate));
  useEffect(() => { if (visible) setCursor(new Date(initialDate)); }, [initialDate, visible]);
  const days = monthDays(cursor);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.calendarCard}><View style={styles.calendarHeader}><Pressable onPress={() => setCursor(addMonths(cursor, -1))} style={styles.calendarNav}><MaterialCommunityIcons name="chevron-left" size={22} color={palette.navy} /></Pressable><Text style={styles.calendarTitle}>{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => setCursor(addMonths(cursor, 1))} style={styles.calendarNav}><MaterialCommunityIcons name="chevron-right" size={22} color={palette.navy} /></Pressable></View><View style={styles.weekRow}>{['S','M','T','W','T','F','S'].map((item, index) => <Text key={`${item}-${index}`} style={styles.weekText}>{item}</Text>)}</View><View style={styles.dayGrid}>{days.map((day, index) => day ? <Pressable key={day} onPress={() => onSelect(toISO(new Date(cursor.getFullYear(), cursor.getMonth(), day)))} style={styles.dayCell}><Text style={styles.dayText}>{day}</Text></Pressable> : <View key={`empty-${index}`} style={styles.dayCell} />)}</View><Pressable onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>Cancel</Text></Pressable></View></View></Modal>;
}

function today() { return toISO(new Date()); }
function toISO(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function addMonths(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function monthDays(date: Date) { const first = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); return [...Array(first).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]; }

const styles = StyleSheet.create({
  compactTitle: { color: palette.navy, fontSize: 18, fontWeight: '900', marginBottom: 6, marginTop: -6 },
  formCard: { borderRadius: 18 },
  accountBlock: { gap: 8, marginBottom: 10 },
  accountLabel: { color: palette.slate, fontSize: 12, fontWeight: '800' },
  dropdownButton: { minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownMenu: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  dropdownItem: { minHeight: 56, paddingHorizontal: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownItemActive: { backgroundColor: '#EEF5FF' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  accountTitleActive: { color: palette.navy },
  accountMeta: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  accountMetaActive: { color: '#315C99' },
  selectorBlock: { marginBottom: 12, gap: 7 },
  searchShell: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minHeight: 46, color: palette.navy, fontSize: 13.5, fontWeight: '700' },
  suggestionList: { borderRadius: 14, borderWidth: 1, borderColor: '#E2EAF4', backgroundColor: '#F8FBFF', overflow: 'hidden' },
  suggestionItem: { minHeight: 48, paddingHorizontal: 11, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EAF0F7', flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionActive: { backgroundColor: '#EEF5FF' },
  suggestionTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  suggestionMeta: { color: '#65758B', fontSize: 10, fontWeight: '700', marginTop: 2 },
  emptyHint: { color: '#7A8799', fontSize: 11, fontWeight: '700', padding: 12 },
  dateRow: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  dateBox: { flex: 1, minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 11 },
  dateLabel: { color: palette.slate, fontSize: 10.5, fontWeight: '800' },
  dateValueRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateValue: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  datePlaceholder: { color: '#8A94A6' },
  moneyField: { marginBottom: 12 },
  moneyLabel: { color: palette.slate, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  moneyShell: { minHeight: 54, borderRadius: 17, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  rupee: { color: '#12805C', fontSize: 22, fontWeight: '900' },
  moneyInput: { flex: 1, minHeight: 50, color: palette.navy, fontSize: 17, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.42)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  calendarCard: { width: '100%', maxWidth: 360, borderRadius: 20, backgroundColor: '#FFFFFF', padding: 14 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calendarNav: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  calendarTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  weekRow: { flexDirection: 'row' },
  weekText: { width: `${100 / 7}%`, textAlign: 'center', color: '#65758B', fontSize: 10, fontWeight: '900', paddingVertical: 6 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  dayText: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F8FBFF', color: palette.navy, fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 34, overflow: 'hidden' },
  modalClose: { minHeight: 44, borderRadius: 14, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  modalCloseText: { color: palette.navy, fontSize: 12, fontWeight: '900' },
});
