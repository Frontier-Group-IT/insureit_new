import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Message, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts, isPortfolioCustomerContext, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

const policyTypeOptions = ['Motor', 'Health', 'Life', 'Travel', 'Personal Accident', 'Fire', 'Marine', 'Engineering', 'Liability', 'Cyber', 'Property', 'Agriculture / Crop', 'Other / Miscellaneous'];

export default function AddPolicyScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activePolicyVehicleIds, setActivePolicyVehicleIds] = useState<Set<string>>(new Set());
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [insurerQuery, setInsurerQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [policyType, setPolicyType] = useState('Motor');
  const [policyTypeOpen, setPolicyTypeOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [idv, setIdv] = useState('');
  const [dateTarget, setDateTarget] = useState<{ label: string; value: string; onChange: (value: string) => void; autoEnd?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const lockedToRouteVehicle = Boolean(vehicleId && selectedVehicleId);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const selectedContext = contexts.find((context) => context.customer_id === selectedCustomerId) ?? null;
  const selectedInsurer = companies.find((company) => company.id === selectedCompanyId) ?? null;

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextContexts = await getOperationalCustomerContexts();
      const ids = nextContexts.map((context) => context.customer_id);
      const [vehicleResult, companyResult, policyResult, externalPolicyResult] = await Promise.all([
        ids.length ? supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no') : Promise.resolve({ data: [] as Vehicle[] }),
        supabase.from('insurance_companies').select('*').order('name'),
        ids.length ? supabase.from('policies').select('vehicle_id,start_date,end_date').in('customer_id', ids) : Promise.resolve({ data: [] as { vehicle_id: string; start_date: string; end_date: string }[] }),
        ids.length ? (supabase as any).from('external_policies').select('vehicle_id,start_date,end_date').in('customer_id', ids) : Promise.resolve({ data: [] as { vehicle_id: string; start_date: string; end_date: string }[] }),
      ]);
      if (!active) return;
      const nextVehicles = (vehicleResult.data ?? []) as Vehicle[];
      const nextActivePolicyVehicleIds = new Set<string>([
        ...((policyResult.data ?? []) as { vehicle_id: string; start_date: string; end_date: string }[]),
        ...((externalPolicyResult.data ?? []) as { vehicle_id: string; start_date: string; end_date: string }[]),
      ].filter((policy) => isPolicyCurrentlyActive(policy.start_date, policy.end_date)).map((policy) => policy.vehicle_id));
      const requestedVehicle = vehicleId ? nextVehicles.find((vehicle) => vehicle.id === vehicleId) : null;
      const routeVehicle = requestedVehicle && !nextActivePolicyVehicleIds.has(requestedVehicle.id) ? requestedVehicle : null;
      setContexts(nextContexts);
      setVehicles(nextVehicles);
      setActivePolicyVehicleIds(nextActivePolicyVehicleIds);
      setCompanies((companyResult.data ?? []) as InsuranceCompany[]);
      setSelectedCustomerId((routeVehicle ?? requestedVehicle)?.customer_id ?? nextContexts[0]?.customer_id ?? '');
      if (routeVehicle) {
        setSelectedVehicleId(routeVehicle.id);
        setVehicleQuery(routeVehicle.vehicle_no);
      } else if (requestedVehicle && nextActivePolicyVehicleIds.has(requestedVehicle.id)) {
        setMessage('This vehicle already has an active policy. A second policy cannot be added until the current policy expires.');
      }
    }
    void load();
    return () => { active = false; };
  }, [router, vehicleId]);

  const accountVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.customer_id === selectedCustomerId && !activePolicyVehicleIds.has(vehicle.id)), [activePolicyVehicleIds, selectedCustomerId, vehicles]);
  const filteredVehicles = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase();
    if (!query) return [];
    return accountVehicles.filter((vehicle) => `${vehicle.vehicle_no} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.toLowerCase().includes(query)).slice(0, 8);
  }, [accountVehicles, vehicleQuery]);
  const filteredCompanies = useMemo(() => {
    const query = insurerQuery.trim().toLowerCase();
    if (!query || selectedCompanyId) return [];
    return companies.filter((company) => company.name.toLowerCase().includes(query)).slice(0, 10);
  }, [companies, insurerQuery, selectedCompanyId]);

  function chooseStartDate(value: string) {
    setStartDate(value);
    setEndDate(defaultPolicyEndDate(value));
  }

  async function save() {
    setMessage('');
    if (saving) return;
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const target = contexts.find((context) => context.customer_id === selectedCustomerId);
    if (!target) return setMessage('Select the customer account for this policy.');
    if (!selectedVehicleId) return setMessage('Select a vehicle for this policy.');
    if (activePolicyVehicleIds.has(selectedVehicleId)) return setMessage('This vehicle already has an active policy.');
    if (!selectedCompanyId) return setMessage('Search and select the insurer.');
    if (!policyNo.trim()) return setMessage('Enter policy number.');
    if (!policyType.trim()) return setMessage('Select policy type.');
    if (!startDate || !endDate) return setMessage('Select policy start date.');
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) return setMessage('End date must be after start date.');
    const premiumValue = premium ? Number(premium) : null;
    if (premiumValue !== null && (!Number.isFinite(premiumValue) || premiumValue < 0)) return setMessage('Enter a valid premium amount.');
    const idvValue = idv ? Number(idv) : null;
    if (idvValue !== null && (!Number.isFinite(idvValue) || idvValue < 0)) return setMessage('Enter a valid IDV.');

    const payload = {
      p_customer_id: target.customer_id,
      p_vehicle_id: selectedVehicleId,
      p_insurance_company_id: selectedCompanyId,
      p_policy_no: policyNo.trim().toUpperCase(),
      p_policy_type: policyType.trim(),
      p_start_date: startDate,
      p_end_date: endDate,
      p_premium_amount: premiumValue,
      p_insured_declared_value: idvValue,
    };

    setSaving(true);
    let result = await (supabase.rpc as any)('create_customer_policy', payload);
    if (isMissingPolicyRpcSignature(result.error)) {
      const { p_insured_declared_value, ...legacyPayload } = payload;
      result = await (supabase.rpc as any)('create_customer_policy', legacyPayload);
    }
    setSaving(false);
    if (result.error) setMessage(result.error.message || 'We could not save this policy. Please try again.');
    else router.replace(contexts.some(isPortfolioCustomerContext) ? '/customer/group/policies' : '/customer/policies');
  }

  return (
    <Screen title="Add Policy" showLogout showTitleHeader={false}>
      <Text style={styles.compactTitle}>Add Policy</Text>
      <Card style={styles.formCard}>
        <View pointerEvents="none" style={styles.formAccentOne} />
        <View pointerEvents="none" style={styles.formAccentTwo} />
        {message ? <Message type="error">{message}</Message> : null}

        {contexts.length > 1 && !lockedToRouteVehicle ? <AccountDropdown contexts={contexts} selectedCustomerId={selectedCustomerId} open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} onSelect={(customerId) => { setSelectedCustomerId(customerId); setAccountOpen(false); setSelectedVehicleId(''); setVehicleQuery(''); }} /> : null}
        {selectedContext && (contexts.length <= 1 || lockedToRouteVehicle) ? <AccountPill context={selectedContext} /> : null}

        <FormSection title="Vehicle" icon="truck-outline" tone="vehicle">
          {lockedToRouteVehicle ? <LockedVehicle vehicle={selectedVehicle} /> : <VehicleSearch query={vehicleQuery} selectedVehicleId={selectedVehicleId} vehicles={filteredVehicles} onChange={(value) => { setSelectedVehicleId(''); setVehicleQuery(value.replace(/\s/g, '').toUpperCase()); }} onSelect={(vehicle) => { setSelectedVehicleId(vehicle.id); setVehicleQuery(vehicle.vehicle_no); setSelectedCustomerId(vehicle.customer_id); }} />}
        </FormSection>

        <FormSection title="Policy details" icon="file-document-outline" tone="policy">
          <SearchInsurer query={insurerQuery} selectedInsurer={selectedInsurer} companies={filteredCompanies} onChange={(value) => { setSelectedCompanyId(''); setInsurerQuery(value); }} onSelect={(company) => { setSelectedCompanyId(company.id); setInsurerQuery(company.name); }} />
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><InputField icon="identifier" label="Policy no." value={policyNo} onChangeText={(value) => setPolicyNo(value.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" /></View>
            <View style={styles.column}><PolicyTypeDropdown value={policyType} open={policyTypeOpen} onToggle={() => setPolicyTypeOpen((value) => !value)} onSelect={(value) => { setPolicyType(value); setPolicyTypeOpen(false); }} /></View>
          </View>
        </FormSection>

        <FormSection title="Validity and value" icon="calendar-check-outline" tone="value">
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><PremiumDateField label="Start date" value={startDate} onPress={() => setDateTarget({ label: 'Policy start date', value: startDate, onChange: chooseStartDate, autoEnd: true })} /></View>
            <View style={styles.column}><ReadonlyDateField label="End date" value={endDate} /></View>
          </View>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}><MoneyField label="IDV" icon="car-info" value={idv} onChangeText={setIdv} /></View>
            <View style={styles.column}><MoneyField label="Premium" icon="currency-inr" value={premium} onChangeText={setPremium} /></View>
          </View>
        </FormSection>

        <Button label={saving ? 'Saving policy...' : 'Save policy'} onPress={save} disabled={saving} />
        {saving ? <ActivityIndicator color={palette.navy} /> : null}
      </Card>
      <PremiumCalendarModal
        target={dateTarget}
        onClose={() => setDateTarget(null)}
        onSelect={(value) => {
          dateTarget?.onChange(value);
          setDateTarget(null);
        }}
      />
    </Screen>
  );
}

function FormSection({ title, icon, tone, children }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: 'vehicle' | 'policy' | 'value'; children: React.ReactNode }) {
  return (
    <View style={[styles.section, tone === 'vehicle' && styles.vehicleSection, tone === 'policy' && styles.policySection, tone === 'value' && styles.valueSection]}>
      <View style={[styles.sectionHeader, tone === 'vehicle' && styles.vehicleSectionHeader, tone === 'policy' && styles.policySectionHeader, tone === 'value' && styles.valueSectionHeader]}>
        <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function AccountPill({ context }: { context: CustomerAccountContext }) {
  return <View style={styles.accountPill}><MaterialCommunityIcons name="office-building-outline" size={17} color="#0A43A3" /><View style={styles.flex}><Text style={styles.accountPillLabel}>Add for</Text><Text style={styles.accountPillTitle} numberOfLines={1}>{customerAccountTitle(context)}</Text></View></View>;
}

function AccountDropdown({ contexts, selectedCustomerId, open, onToggle, onSelect }: { contexts: CustomerAccountContext[]; selectedCustomerId: string; open: boolean; onToggle: () => void; onSelect: (customerId: string) => void }) {
  const selected = contexts.find((context) => context.customer_id === selectedCustomerId);
  return (
    <View style={styles.accountBlock}>
      <Text style={styles.fieldLabel}>Add for</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.dropdownButton}>
        <View style={styles.accountCopy}>
          <Text style={styles.accountTitle} numberOfLines={1}>{selected ? customerAccountTitle(selected) : 'Select customer'}</Text>
          <Text style={styles.accountMeta}>{selected ? `${selected.access_source === 'group_child' ? 'Associated account' : 'Parent account'} - ${partnerTypeLabel(selected.partner_type)}` : 'Choose policy owner'}</Text>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.dropdownMenu}>{contexts.map((context) => {
        const active = context.customer_id === selectedCustomerId;
        return <Pressable key={context.customer_id} accessibilityRole="button" onPress={() => onSelect(context.customer_id)} style={[styles.dropdownItem, active && styles.dropdownItemActive]}><View style={styles.accountCopy}><Text style={[styles.accountTitle, active && styles.accountTitleActive]} numberOfLines={1}>{customerAccountTitle(context)}</Text><Text style={[styles.accountMeta, active && styles.accountMetaActive]}>{context.access_source === 'group_child' ? 'Associated account' : 'Parent account'} - {partnerTypeLabel(context.partner_type)}</Text></View>{active ? <MaterialCommunityIcons name="check-circle" size={19} color={palette.navy} /> : null}</Pressable>;
      })}</View> : null}
    </View>
  );
}

function LockedVehicle({ vehicle }: { vehicle: Vehicle | null }) {
  return (
    <View style={styles.lockedVehicle}>
      <View style={styles.lockedIcon}><MaterialCommunityIcons name="lock-check-outline" size={18} color="#0A43A3" /></View>
      <View style={styles.flex}>
        <Text style={styles.lockedLabel}>Vehicle number</Text>
        <Text style={styles.lockedTitle} numberOfLines={1}>{vehicle?.vehicle_no ?? 'Loading vehicle'}</Text>
      </View>
      <Text style={styles.lockedBadge}>Locked</Text>
    </View>
  );
}

function VehicleSearch({ query, selectedVehicleId, vehicles, onChange, onSelect }: { query: string; selectedVehicleId: string; vehicles: Vehicle[]; onChange: (value: string) => void; onSelect: (vehicle: Vehicle) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Vehicle number</Text>
      <View style={styles.inputShell}><MaterialCommunityIcons name="magnify" size={17} color="#6A7A90" /><TextInput value={query} onChangeText={onChange} autoCapitalize="characters" placeholder="Search vehicle number" placeholderTextColor="#9AA7B8" style={styles.input} /></View>
      <View style={styles.selectMenu}>{query.trim() ? vehicles.map((vehicle) => {
        const active = selectedVehicleId === vehicle.id;
        return <Pressable key={vehicle.id} accessibilityRole="button" onPress={() => onSelect(vehicle)} style={[styles.selectOption, active && styles.selectOptionActive]}><View style={styles.accountCopy}><Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]}>{vehicle.vehicle_no}</Text><Text style={styles.accountMeta}>{[vehicle.make, vehicle.model].filter(Boolean).join(' - ') || vehicle.vehicle_type}</Text></View>{active ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>;
      }) : <Text style={styles.emptyLookupText}>Start typing to find a vehicle.</Text>}</View>
    </View>
  );
}

function SearchInsurer({ query, selectedInsurer, companies, onChange, onSelect }: { query: string; selectedInsurer: InsuranceCompany | null; companies: InsuranceCompany[]; onChange: (value: string) => void; onSelect: (company: InsuranceCompany) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Insurer</Text>
      <View style={styles.inputShell}>
        <MaterialCommunityIcons name="magnify" size={17} color="#6A7A90" />
        <TextInput value={query} onChangeText={onChange} placeholder="Search insurer by name" placeholderTextColor="#9AA7B8" style={styles.input} />
        {selectedInsurer ? <MaterialCommunityIcons name="check-circle" size={18} color="#12805C" /> : null}
      </View>
      <View style={styles.selectMenu}>
        {!query.trim() ? <Text style={styles.emptyLookupText}>Type matching letters to search insurer.</Text> : selectedInsurer ? <Text style={styles.emptyLookupText}>Selected: {selectedInsurer.name}</Text> : companies.length ? companies.map((company) => <Pressable key={company.id} accessibilityRole="button" onPress={() => onSelect(company)} style={styles.selectOption}><Text style={styles.selectOptionText} numberOfLines={1}>{company.name}</Text></Pressable>) : <Text style={styles.emptyLookupText}>No matching insurer found.</Text>}
      </View>
    </View>
  );
}

function InputField({ label, icon, style, ...props }: React.ComponentProps<typeof TextInput> & { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}><MaterialCommunityIcons name={icon} size={17} color="#6A7A90" /><TextInput {...props} placeholderTextColor="#9AA7B8" style={[styles.input, style]} /></View>
    </View>
  );
}

function PolicyTypeDropdown({ value, open, onToggle, onSelect }: { value: string; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Policy type</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name="shield-car" size={18} color="#0A43A3" /></View>
        <Text style={styles.selectValue} numberOfLines={1}>{value}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.selectMenu}>{policyTypeOptions.map((type) => {
        const active = value === type;
        return <Pressable key={type} accessibilityRole="button" onPress={() => onSelect(type)} style={[styles.selectOption, active && styles.selectOptionActive]}><Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]} numberOfLines={1}>{type}</Text>{active ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>;
      })}</View> : null}
    </View>
  );
}

function PremiumDateField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Pressable accessibilityRole="button" onPress={onPress} style={styles.dateButton}><View style={styles.dateIcon}><MaterialCommunityIcons name="calendar-month-outline" size={17} color="#0A43A3" /></View><Text style={[styles.dateValue, !value && styles.datePlaceholder]} numberOfLines={1}>{value ? formatDisplayDate(value) : 'Select date'}</Text></Pressable></View>;
}

function ReadonlyDateField({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={[styles.dateButton, styles.readonlyDate]}><View style={styles.dateIcon}><MaterialCommunityIcons name="calendar-sync-outline" size={17} color="#0A43A3" /></View><Text style={[styles.dateValue, !value && styles.datePlaceholder]} numberOfLines={1}>{value ? formatDisplayDate(value) : 'Auto after start'}</Text></View></View>;
}

function MoneyField({ label, icon, value, onChangeText }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; value: string; onChangeText: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label} optional</Text><View style={styles.inputShell}><MaterialCommunityIcons name={icon} size={17} color="#12805C" /><Text style={styles.moneyPrefix}>Rs.</Text><TextInput value={value} onChangeText={(next) => onChangeText(next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9AA7B8" style={styles.input} /></View></View>;
}

function PremiumCalendarModal({ target, onClose, onSelect }: { target: { label: string; value: string; onChange: (value: string) => void; autoEnd?: boolean } | null; onClose: () => void; onSelect: (value: string) => void }) {
  const [cursor, setCursor] = useState(() => monthStart(parseDate(target?.value ?? '') ?? new Date()));
  const selected = parseDate(target?.value ?? '');
  const days = useMemo(() => buildMonthDays(cursor), [cursor]);
  useEffect(() => { if (target) setCursor(monthStart(parseDate(target.value) ?? new Date())); }, [target]);
  return (
    <Modal visible={Boolean(target)} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.calendarScreen}>
        <View pointerEvents="none" style={styles.calendarAccent} />
        <View style={styles.calendarTopBar}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.calendarClose}><MaterialCommunityIcons name="close" size={22} color={palette.navy} /></Pressable>
          <View style={styles.calendarHeadingCopy}><Text style={styles.calendarEyebrow}>Policy validity</Text><Text style={styles.calendarHeading} numberOfLines={1}>Select {target?.label ?? 'date'}</Text></View>
        </View>
        <View style={styles.calendarHero}><View style={styles.calendarHeroIcon}><MaterialCommunityIcons name={target?.autoEnd ? 'calendar-sync-outline' : 'calendar-check-outline'} size={27} color="#FFFFFF" /></View><View style={styles.flex}><Text style={styles.calendarHeroTitle}>{target?.label ?? 'Date'}</Text><Text style={styles.calendarHeroText}>{target?.autoEnd ? 'End date will be filled automatically' : target?.value ? formatDisplayDate(target.value) : 'No date selected yet'}</Text></View></View>
        <View style={styles.calendarCard}>
          <View style={styles.monthControl}>
            <Pressable accessibilityRole="button" onPress={() => setCursor((current) => new Date(current.getFullYear() - 1, current.getMonth(), 1))} style={styles.yearButton}><MaterialCommunityIcons name="chevron-double-left" size={19} color={palette.navy} /></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={styles.monthButton}><MaterialCommunityIcons name="chevron-left" size={22} color={palette.navy} /></Pressable>
            <View style={styles.monthTitleWrap}><Text style={styles.monthTitle}>{cursor.toLocaleDateString('en-IN', { month: 'long' })}</Text><Text style={styles.yearTitle}>{cursor.getFullYear()}</Text></View>
            <Pressable accessibilityRole="button" onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={styles.monthButton}><MaterialCommunityIcons name="chevron-right" size={22} color={palette.navy} /></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setCursor((current) => new Date(current.getFullYear() + 1, current.getMonth(), 1))} style={styles.yearButton}><MaterialCommunityIcons name="chevron-double-right" size={19} color={palette.navy} /></Pressable>
          </View>
          <View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((item, index) => <Text key={`${item}-${index}`} style={styles.weekDay}>{item}</Text>)}</View>
          <View style={styles.calendarGrid}>{days.map((day, index) => {
            const isSelected = Boolean(selected && sameDate(selected, day.date));
            return <Pressable key={`${day.date.toISOString()}-${index}`} accessibilityRole="button" onPress={() => onSelect(formatIsoDate(day.date))} style={[styles.dayCell, !day.inMonth && styles.dayMuted, isSelected && styles.daySelected]}><Text style={[styles.dayText, !day.inMonth && styles.dayTextMuted, isSelected && styles.dayTextSelected]}>{day.date.getDate()}</Text></Pressable>;
          })}</View>
        </View>
        <View style={styles.calendarFooter}><Pressable accessibilityRole="button" onPress={() => onSelect(formatIsoDate(new Date()))} style={styles.todayButton}><Text style={styles.todayButtonText}>Use Today</Text></Pressable><Pressable accessibilityRole="button" onPress={onClose} style={styles.doneButton}><Text style={styles.doneButtonText}>Done</Text></Pressable></View>
      </View>
    </Modal>
  );
}

function isMissingPolicyRpcSignature(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === 'PGRST202' || (message.includes('create_customer_policy') && (message.includes('schema cache') || message.includes('could not find the function')));
}

function isPolicyCurrentlyActive(startDate: string, endDate: string) {
  const currentDate = formatIsoDate(new Date());
  return startDate <= currentDate && endDate >= currentDate;
}

function defaultPolicyEndDate(startIso: string) {
  const start = parseDate(startIso);
  if (!start) return '';
  const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  end.setDate(end.getDate() - 1);
  return formatIsoDate(end);
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}
function monthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function buildMonthDays(month: Date) { const first = monthStart(month); const start = new Date(first); start.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { date, inMonth: date.getMonth() === month.getMonth() }; }); }
function sameDate(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatIsoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatDisplayDate(value: string) { const parsed = parseDate(value); return parsed ? parsed.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : value; }

const styles = StyleSheet.create({
  flex: { flex: 1 },
  compactTitle: { color: palette.navy, fontSize: 16, fontWeight: '800', marginBottom: 6, marginTop: -30, letterSpacing: 0 },
  formCard: { borderRadius: 18, padding: 12, gap: 12, backgroundColor: '#F8FBFF', borderColor: '#CFE0F8', overflow: 'hidden' },
  formAccentOne: { position: 'absolute', right: -28, top: -18, width: 110, height: 58, borderRadius: 18, backgroundColor: 'rgba(10,67,163,0.08)', transform: [{ rotate: '-10deg' }] },
  formAccentTwo: { position: 'absolute', left: -20, bottom: 80, width: 86, height: 48, borderRadius: 16, backgroundColor: 'rgba(18,128,92,0.08)', transform: [{ rotate: '12deg' }] },
  accountBlock: { gap: 6 },
  accountPill: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  accountPillLabel: { color: '#607089', fontSize: 9.5, fontWeight: '700' },
  accountPillTitle: { color: palette.navy, fontSize: 12, fontWeight: '800', marginTop: 1 },
  section: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: 'rgba(255,255,255,0.94)', overflow: 'hidden', shadowColor: '#0A43A3', shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 },
  vehicleSection: { borderColor: '#B8D4F7', backgroundColor: '#EEF6FF' },
  policySection: { borderColor: '#F1D1A6', backgroundColor: '#FFF7EC' },
  valueSection: { borderColor: '#B9E6D0', backgroundColor: '#EFFAF5' },
  sectionHeader: { minHeight: 42, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F7FF', borderBottomWidth: 1, borderBottomColor: '#E1ECF8' },
  vehicleSectionHeader: { backgroundColor: '#DDEEFF', borderBottomColor: '#B8D4F7' },
  policySectionHeader: { backgroundColor: '#FFECD0', borderBottomColor: '#F1D1A6' },
  valueSectionHeader: { backgroundColor: '#DCF6EA', borderBottomColor: '#B9E6D0' },
  sectionIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 13, fontWeight: '800', letterSpacing: 0 },
  sectionBody: { padding: 11, gap: 10 },
  field: { gap: 5 },
  fieldLabel: { color: '#3F4D63', fontSize: 10.5, fontWeight: '700', letterSpacing: 0 },
  inputShell: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FBFDFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  input: { flex: 1, minHeight: 43, color: palette.navy, fontSize: 12.6, fontWeight: '600', letterSpacing: 0 },
  twoColumnRow: { flexDirection: 'row', gap: 9 },
  column: { flex: 1, minWidth: 0 },
  lockedVehicle: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#B8D4F7', backgroundColor: '#FFFFFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  lockedIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  lockedLabel: { color: '#607089', fontSize: 9.5, fontWeight: '700' },
  lockedTitle: { color: palette.navy, fontSize: 16, fontWeight: '900', letterSpacing: 0.3, marginTop: 1 },
  lockedBadge: { color: '#12805C', fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: '#EAF8F1', overflow: 'hidden' },
  selectButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FBFDFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  selectValue: { flex: 1, color: palette.navy, fontSize: 12.1, fontWeight: '700' },
  selectMenu: { borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  selectOption: { minHeight: 43, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  selectOptionActive: { backgroundColor: '#EEF5FF' },
  selectOptionText: { flex: 1, color: '#607089', fontSize: 11.5, fontWeight: '700' },
  selectOptionTextActive: { color: palette.navy, fontWeight: '800' },
  emptyLookupText: { color: '#7A8799', fontSize: 11, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 12 },
  dropdownButton: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F8FBFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownMenu: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  dropdownItem: { minHeight: 54, paddingHorizontal: 11, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownItemActive: { backgroundColor: '#EEF5FF' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: palette.ink, fontSize: 12.5, fontWeight: '800' },
  accountTitleActive: { color: palette.navy },
  accountMeta: { color: palette.slate, fontSize: 10, fontWeight: '700', marginTop: 2 },
  accountMetaActive: { color: '#315C99' },
  dateButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#F7FBFF', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  readonlyDate: { backgroundColor: '#F3F8FC' },
  dateIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  dateValue: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '700' },
  datePlaceholder: { color: '#7F8EA4', fontWeight: '600' },
  moneyPrefix: { color: '#12805C', fontSize: 11, fontWeight: '900' },
  calendarScreen: { flex: 1, backgroundColor: '#EEF7FF', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 },
  calendarAccent: { position: 'absolute', left: -70, right: -70, top: 118, height: 120, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.64)', transform: [{ rotate: '-7deg' }] },
  calendarTopBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  calendarClose: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE0F8', alignItems: 'center', justifyContent: 'center' },
  calendarHeadingCopy: { flex: 1, minWidth: 0 },
  calendarEyebrow: { color: '#607089', fontSize: 10.5, fontWeight: '700' },
  calendarHeading: { color: palette.navy, fontSize: 20, lineHeight: 25, fontWeight: '800', marginTop: 1 },
  calendarHero: { minHeight: 78, borderRadius: 20, backgroundColor: palette.navy, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, shadowColor: palette.navy, shadowOpacity: 0.16, shadowRadius: 13, elevation: 4 },
  calendarHeroIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  calendarHeroTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  calendarHeroText: { color: '#CFE0F8', fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  calendarCard: { flex: 1, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', marginTop: 14, padding: 14, shadowColor: '#0A43A3', shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  monthControl: { minHeight: 52, borderRadius: 18, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 13 },
  monthButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  yearButton: { width: 31, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthTitleWrap: { flex: 1, alignItems: 'center' },
  monthTitle: { color: palette.navy, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  yearTitle: { color: '#607089', fontSize: 11, fontWeight: '700', marginTop: 1 },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekDay: { width: `${100 / 7}%`, textAlign: 'center', color: '#607089', fontSize: 12, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 15, marginVertical: 2 },
  dayMuted: { opacity: 0.34 },
  daySelected: { backgroundColor: '#0A43A3', shadowColor: '#0A43A3', shadowOpacity: 0.18, shadowRadius: 8, elevation: 2 },
  dayText: { color: palette.navy, fontSize: 14, fontWeight: '700' },
  dayTextMuted: { color: '#7F8EA4' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '900' },
  calendarFooter: { flexDirection: 'row', gap: 10, marginTop: 14 },
  todayButton: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#B8D4F7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  todayButtonText: { color: palette.navy, fontSize: 13, fontWeight: '800' },
  doneButton: { flex: 1, minHeight: 50, borderRadius: 15, backgroundColor: '#0A43A3', alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
