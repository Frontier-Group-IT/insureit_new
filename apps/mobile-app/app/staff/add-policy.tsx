import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppDatePicker, AppSearchSelect, AppSectionHeader } from '@/components/design-system';
import { Button, Card, LoadingState, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { canManageBusinessRecords } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Customer, InsuranceCompany, Vehicle } from '@/lib/types';

export default function StaffAddPolicyScreen() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [policyType, setPolicyType] = useState('Commercial comprehensive');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(function load() {
    let active = true;
    async function run() {
      setMessage('');
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const profile = await getProfile(session.user.id);
      if (!isValidProfile(profile) || !canManageBusinessRecords(profile.role)) return router.replace('/access-denied');
      const [customerResult, vehicleResult, companyResult] = await Promise.all([
        supabase.from('customers').select('*').order('contact_name'),
        supabase.from('vehicles').select('*').order('vehicle_no'),
        supabase.from('insurance_companies').select('*').order('name'),
      ]);
      if (!active) return;
      if (customerResult.error || vehicleResult.error || companyResult.error) {
        console.error('Manager add policy lookup failed', { customerError: customerResult.error, vehicleError: vehicleResult.error, companyError: companyResult.error });
        setMessage('We could not load policy setup records. Please reopen the screen and try again.');
      }
      setCustomers(customerResult.data ?? []);
      setVehicles(vehicleResult.data ?? []);
      setCompanies(companyResult.data ?? []);
      setLoading(false);
    }
    void run();
    return () => {
      active = false;
    };
  }, [router]);

  useFocusEffect(load);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const customerVehicles = vehicles.filter((vehicle) => vehicle.customer_id === selectedCustomerId);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;

  async function save() {
    setMessage('');
    setSuccess('');
    if (!selectedCustomer || !selectedVehicle || !selectedCompany || !policyNo.trim() || !policyType.trim() || !startDate || !endDate) {
      setMessage('Customer, vehicle, insurer, policy number, type, start date, and end date are required.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('policies').insert({
        customer_id: selectedCustomer.id,
        vehicle_id: selectedVehicle.id,
        insurance_company_id: selectedCompany.id,
        policy_no: policyNo.trim(),
        policy_type: policyType.trim(),
        start_date: startDate,
        end_date: endDate,
        premium_amount: premium ? Number(premium) : null,
      });
      if (error) throw error;
      setSuccess('Policy added to customer profile.');
      setPolicyNo('');
      setPremium('');
    } catch (error) {
      console.error('Manager add policy failed', error);
      setMessage('We could not save this policy. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title="Add Policy"><LoadingState label="Loading customers" /></Screen>;

  return (
    <Screen title="Add Policy" subtitle="Add a policy record to a customer vehicle.">
      {message ? <Message type="error">{message}</Message> : null}
      {success ? <Message type="success">{success}</Message> : null}
      <View style={styles.setupHero}>
        <View style={styles.setupIcon}>
          <MaterialCommunityIcons name="shield-plus-outline" size={24} color={roleTheme.ops.accent} />
        </View>
        <View style={styles.setupCopy}>
          <Text style={styles.setupTitle}>Policy setup</Text>
          <Text style={styles.setupText}>Choose the customer vehicle, insurer, and policy dates so claim intake has complete coverage data.</Text>
        </View>
      </View>
      <Card>
        <AppSectionHeader title="Customer" />
        <AppSearchSelect
          label="Customer"
          placeholder="Search customer by name, phone, code"
          options={customers}
          selectedId={selectedCustomerId}
          onSelect={(customer) => {
            setSelectedCustomerId(customer.id);
            setSelectedVehicleId('');
          }}
          getTitle={(customer) => customer.contact_name}
          getSubtitle={(customer) => [customer.company_name, customer.phone, customer.customer_code].filter(Boolean).join(' | ')}
        />
        <Row label="Selected customer" value={selectedCustomer?.contact_name} />
      </Card>
      <Card>
        <AppSectionHeader title="Vehicle" />
        <AppSearchSelect
          label="Vehicle"
          placeholder="Search vehicle number, make, model"
          options={customerVehicles}
          selectedId={selectedVehicleId}
          onSelect={(vehicle) => setSelectedVehicleId(vehicle.id)}
          getTitle={(vehicle) => vehicle.vehicle_no}
          getSubtitle={(vehicle) => [vehicle.make, vehicle.model, vehicle.vehicle_type].filter(Boolean).join(' | ')}
        />
        <Row label="Selected vehicle" value={selectedVehicle?.vehicle_no} />
      </Card>
      <Card>
        <AppSectionHeader title="Policy" actionLabel="Add insurer" onAction={() => router.push('/staff/add-insurer')} />
        <Row label="Insurers available" value={companies.length} />
        <AppSearchSelect
          label="Insurer"
          placeholder="Search insurer by name, branch, contact"
          options={companies}
          selectedId={selectedCompanyId}
          onSelect={(company) => setSelectedCompanyId(company.id)}
          getTitle={(company) => company.name}
          getSubtitle={(company) => [company.branch_name, company.contact_phone, company.contact_email].filter(Boolean).join(' | ')}
        />
        <Row label="Selected insurer" value={selectedCompany?.name} />
        <TextField label="Policy number" value={policyNo} onChangeText={setPolicyNo} />
        <TextField label="Policy type" value={policyType} onChangeText={setPolicyType} />
        <AppDatePicker label="Start date" value={startDate} onChange={setStartDate} />
        <AppDatePicker label="End date" value={endDate} onChange={setEndDate} />
        <TextField label="Premium amount" value={premium} onChangeText={setPremium} keyboardType="decimal-pad" />
        <Button label={saving ? 'Saving policy...' : 'Save policy'} onPress={save} disabled={saving} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  setupHero: { borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  setupIcon: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: roleTheme.ops.soft, alignItems: 'center', justifyContent: 'center' },
  setupCopy: { flex: 1, minWidth: 0 },
  setupTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', lineHeight: 23 },
  setupText: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 4 },
});
