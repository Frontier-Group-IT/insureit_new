import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      // Server RPC enforces partner scope, including employee and partner visibility.
      const customers = await listPartnerCustomers({ limit: 100 });
      const accountRows = customers.map(x => ({ customer_id: x.customer_id, customer_name: x.customer_name }));
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
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => choices.filter(c => [c.vehicle.vehicle_no,c.vehicle.make,c.vehicle.model,c.customer.customer_name].some(v => (v||'').toLowerCase().includes(search.toLowerCase()))), [choices,search]);
  const choice = choices.find(x => `${x.customer.customer_id}:${x.vehicle.vehicle_id}` === selected);
  const choose = (row: Choice) => { setSelected(`${row.customer.customer_id}:${row.vehicle.vehicle_id}`); setDropdownOpen(false); setSearch(''); };
  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to claims" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" color="#FFF" size={24}/></Pressable><View style={styles.headerIcon}><Ionicons name="car-sport-outline" color="#FFF" size={20}/></View><Text style={styles.headerTitle}>Select Vehicle</Text></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.heading}>Vehicle number *</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Select vehicle number" accessibilityState={{ expanded: dropdownOpen }} onPress={() => setDropdownOpen(v => !v)} style={styles.vehicleSelect}>
          {choice ? <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(choice.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View> : <Ionicons name="car-outline" size={23} color="#1D569B" />}
          <View style={styles.vehicleText}><Text style={choice ? styles.plate : styles.placeholder}>{choice?.vehicle.vehicle_no || 'Select vehicle number'}</Text>{choice ? <Text style={styles.description} numberOfLines={1}>{[choice.vehicle.make,choice.vehicle.model].filter(Boolean).join(' · ')}</Text> : null}</View>
          <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={21} color="#24528C"/>
        </Pressable>
        {dropdownOpen ? <View style={styles.dropdown}>
          <View style={styles.search}><Ionicons name="search-outline" size={18} color="#3063A0"/><TextInput accessibilityLabel="Search available vehicles" autoFocus value={search} onChangeText={setSearch} placeholder="Search number, make, model or customer" placeholderTextColor="#899CB3" style={styles.input}/></View>
          {busy ? <Text style={styles.hint}>Loading authorized vehicles...</Text> : error ? <Text style={styles.error}>{error}</Text> : !shown.length ? <Text style={styles.hint}>No matching vehicles found.</Text> :
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always" style={styles.options}>
              {shown.map(row => <Pressable key={row.customer.customer_id + ':' + row.vehicle.vehicle_id} accessibilityRole="button" onPress={() => choose(row)} style={styles.option}>
                <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(row.vehicle.make) ?? PartnerAssets.navigation.claims} resizeMode="contain" style={styles.logoImage}/></View>
                <View style={styles.vehicleText}><Text style={styles.plate}>{row.vehicle.vehicle_no || 'Registration pending'}</Text><Text style={styles.description} numberOfLines={1}>{[row.vehicle.make,row.vehicle.model].filter(Boolean).join(' · ')}</Text><Text style={styles.customer} numberOfLines={1}>{row.customer.customer_name}</Text></View>
                {selected === `${row.customer.customer_id}:${row.vehicle.vehicle_id}` ? <Ionicons name="checkmark-circle" color="#1465BE" size={21}/> : null}
              </Pressable>)}
            </ScrollView>}
        </View> : null}
      </View>
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
 root:{flex:1,backgroundColor:'#EDF5FF'},
 header:{height:67,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#1261C4'},
 back:{width:34,height:40,justifyContent:'center',alignItems:'center'},
 headerIcon:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.17)'},
 headerTitle:{color:'#FFF',fontSize:18,fontWeight:'900'},
 content:{padding:15,paddingBottom:35,gap:12},
 section:{backgroundColor:'#FFF',borderRadius:17,padding:14,borderWidth:1,borderColor:'#DEE8F4',gap:11},
 heading:{fontSize:14,fontWeight:'900',color:'#122E53'},
 vehicleSelect:{backgroundColor:'#F9FCFF',borderRadius:12,borderWidth:1,borderColor:'#BDCEE2',paddingHorizontal:12,minHeight:66,flexDirection:'row',alignItems:'center',gap:12},
 placeholder:{fontSize:13,color:'#7890AC',fontWeight:'700'},
 dropdown:{gap:8,backgroundColor:'#F8FBFF',borderRadius:13,padding:9,borderWidth:1,borderColor:'#E0E8F2'},
 search:{backgroundColor:'#FFF',borderRadius:10,borderWidth:1,borderColor:'#C8D8E9',flexDirection:'row',alignItems:'center',paddingHorizontal:10},
 input:{height:43,flex:1,marginLeft:8,fontSize:12,color:'#19365B'},
 options:{maxHeight:245},
 option:{flexDirection:'row',gap:10,alignItems:'center',paddingVertical:10,paddingHorizontal:5,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#D7E3F2'},
 hint:{fontSize:11,color:'#667F9A',padding:9},
 error:{fontSize:11,color:'#B42318',padding:9},
 logo:{height:43,width:43,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:'#F0F5FB'},
 logoImage:{height:32,width:32},
 vehicleText:{flex:1,minWidth:0},
 plate:{fontSize:13,fontWeight:'900',color:'#102B54'},
 description:{fontSize:10,color:'#59718F',marginTop:3},
 customer:{fontSize:9,color:'#7186A0',marginTop:3},
 policyTitle:{marginTop:5,paddingHorizontal:3},
 policy:{backgroundColor:'#0B347A',borderRadius:16,padding:15,flexDirection:'row',gap:13,alignItems:'center'},
 policyNo:{fontSize:13,fontWeight:'900',color:'#FFF'},
 policyCaption:{fontSize:10,color:'#D5E5FC',marginTop:5},
 actions:{flexDirection:'row',gap:10,marginTop:5},
 secondary:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:13,borderWidth:1,borderColor:'#C3D4E8',minHeight:52},
 secondaryText:{color:'#154180',fontWeight:'800',fontSize:11},
 primary:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#0B347A',borderRadius:13,minHeight:52},
 disabled:{opacity:0.45},
 primaryText:{fontWeight:'900',fontSize:12,color:'#FFF'}
});
