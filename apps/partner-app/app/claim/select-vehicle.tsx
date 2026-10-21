import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listPartnerCustomers, getPartnerCustomerDetail, type PartnerCustomerDetail } from '@/lib/customers';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';

type Account = { customer_id: string; customer_name: string };
type Choice = { customer: Account; vehicle: PartnerCustomerDetail['vehicles'][number]; policy: PartnerCustomerDetail['policies'][number] | null };
export default function PartnerClaimVehicleSelector() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      // Server RPC enforces partner scope, including employee and partner visibility.
      const customers = await listPartnerCustomers({ limit: 100, search: search.trim() || undefined });
      const accountRows = customers.map(x => ({ customer_id: x.customer_id, customer_name: x.customer_name }));
      setAccounts(accountRows);
      const details = await Promise.all(accountRows.map(async customer => {
        try {
          const detail = await getPartnerCustomerDetail(customer.customer_id);
          return detail.vehicles.map(vehicle => {
            const linked = detail.policies.filter(policy => policy.vehicle_id === vehicle.vehicle_id)
              .sort((a,b) => (b.end_date || '').localeCompare(a.end_date || ''));
            return { customer, vehicle, policy: linked[0] || null };
          });
        } catch { return [] as Choice[]; }
      }));
      setChoices(details.flat());
    } catch {
      setError('Unable to load vehicles in your Partner scope.');
      setChoices([]);
    } finally { setBusy(false); }
  }, [search]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 350); return () => clearTimeout(timer); }, [load]);
  const shown = useMemo(() => choices.filter(c => [c.vehicle.vehicle_no,c.vehicle.make,c.vehicle.model,c.customer.customer_name].some(v => (v||'').toLowerCase().includes(search.toLowerCase()))), [choices,search]);
  const choice = shown.find(x => x.vehicle.vehicle_id === selected) || shown[0];
  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.banner}><Text style={styles.eyebrow}>START A CLAIM</Text><Text style={styles.title}>Select the vehicle</Text><Text style={styles.subtitle}>Choose the vehicle involved and review its linked policy.</Text></View>
      <Text style={styles.heading}>Vehicle number *</Text>
      <View style={styles.search}><Ionicons name="search-outline" color="#3063A0" size={19}/><TextInput accessibilityLabel="Search vehicle" value={search} onChangeText={setSearch} placeholder="Search vehicle, model or customer" style={styles.input}/></View>
      {busy ? <Text style={styles.hint}>Loading authorized vehicles...</Text> : error ? <Text style={styles.error}>{error}</Text> : !shown.length ? <Text style={styles.hint}>No matching vehicles found in your Partner scope.</Text> : shown.map(row => {
        const active = row.vehicle.vehicle_id === (choice?.vehicle.vehicle_id || '');
        return <Pressable key={row.customer.customer_id + ':' + row.vehicle.vehicle_id} onPress={() => setSelected(row.vehicle.vehicle_id)} style={[styles.vehicle,active && styles.active]}>
          <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(row.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View>
          <View style={styles.vehicleText}><Text style={styles.plate}>{row.vehicle.vehicle_no || 'Registration pending'}</Text><Text style={styles.description} numberOfLines={1}>{[row.vehicle.make,row.vehicle.model].filter(Boolean).join(' · ')}</Text><Text style={styles.customer} numberOfLines={1}>{row.customer.customer_name}</Text></View>
          <Ionicons name={active?'checkmark-circle':'ellipse-outline'} size={21} color={active?'#1665CC':'#8EA5C0'}/>
        </Pressable>;
      })}
      <View style={styles.policyTitle}><Text style={styles.heading}>Policy details</Text></View>
      {choice?.policy ? <View style={styles.policy}><PartnerInsurerLogo name={choice.policy.insurer_name || ''} fallback={PartnerAssets.navigation.claims} style={styles.logoImage}/><View style={styles.vehicleText}><Text style={styles.policyNo}>{choice.policy.policy_no || 'Policy number pending'}</Text><Text style={styles.policyCaption}>{choice.policy.insurer_name || 'Insurer not recorded'}</Text><Text style={styles.policyCaption}>Expiry: {choice.policy.end_date || 'Not recorded'}</Text></View></View> : <Text style={styles.hint}>No linked policy found. Claim eligibility requires server verification.</Text>}
      <View style={styles.actions}>
        <Pressable onPress={() => Alert.alert('Get Assistance','Please contact your claims desk for support.')} style={styles.secondary}><Text style={styles.secondaryText}>Get Assistance</Text></Pressable>
        <Pressable disabled={!choice} onPress={() => Alert.alert('Claim creation pending', 'Vehicle selection is available. Secure Partner-scoped claim creation must be enabled before proceeding to Stage 1. No claim has been created.')} style={[styles.primary,!choice && styles.disabled]}><Text style={styles.primaryText}>Start Claim</Text><Ionicons name="arrow-forward" color="#FFF" size={19}/></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:'#EDF5FF'},content:{padding:17,paddingBottom:45,gap:12},banner:{minHeight:166,justifyContent:'center',padding:16,backgroundColor:'#DCEBFF',borderRadius:20,marginBottom:7},eyebrow:{fontSize:11,fontWeight:'900',color:'#2872B6'},title:{fontSize:26,fontWeight:'900',color:'#102B54',marginTop:3},subtitle:{fontSize:12,color:'#51647F',marginTop:8},heading:{fontSize:16,fontWeight:'900',color:'#102B54'},search:{backgroundColor:'#FFF',borderRadius:13,borderWidth:1,borderColor:'#C8D8E9',flexDirection:'row',alignItems:'center',paddingHorizontal:12},input:{height:49,flex:1,marginLeft:8,fontSize:13,color:'#19365B'},hint:{fontSize:12,color:'#667F9A',padding:10},error:{fontSize:12,color:'#B42318',padding:10},vehicle:{flexDirection:'row',gap:11,alignItems:'center',padding:12,borderWidth:1,borderColor:'#DEE7F1',backgroundColor:'#FFF',borderRadius:16},active:{borderColor:'#76A5D7',borderWidth:2},logo:{height:48,width:48,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:'#F6F9FD'},logoImage:{height:35,width:35},vehicleText:{flex:1,minWidth:0},plate:{fontSize:14,fontWeight:'900',color:'#102B54'},description:{fontSize:11,color:'#59718F',marginTop:4},customer:{fontSize:10,color:'#7186A0',marginTop:3},policyTitle:{marginTop:12},policy:{backgroundColor:'#0B347A',borderRadius:18,padding:18,flexDirection:'row',gap:14,alignItems:'center'},policyNo:{fontSize:14,fontWeight:'900',color:'#FFF'},policyCaption:{fontSize:11,color:'#D5E5FC',marginTop:5},actions:{flexDirection:'row',gap:10,marginTop:11},secondary:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:14,borderWidth:1,borderColor:'#C3D4E8',minHeight:55},secondaryText:{color:'#154180',fontWeight:'800',fontSize:12},primary:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#0B347A',borderRadius:14,minHeight:55},disabled:{opacity:0.45},primaryText:{fontWeight:'900',fontSize:12,color:'#FFF'}
});
