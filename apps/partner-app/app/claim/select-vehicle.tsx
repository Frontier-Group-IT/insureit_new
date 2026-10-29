import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listPartnerClaimVehicleChoices, type PartnerClaimVehicleChoice } from '@/lib/claim-vehicle-choices';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import { createPartnerClaim } from '@/lib/claims';

const PAGE_SIZE = 50;
export default function PartnerClaimVehicleSelector() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [choices, setChoices] = useState<PartnerClaimVehicleChoice[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<PartnerClaimVehicleChoice | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async (query: string, offset = 0) => {
    if (offset) setLoadingMore(true);
    else { setBusy(true); setError(''); }
    try {
      const rows = await listPartnerClaimVehicleChoices({ search: query, limit: PAGE_SIZE, offset });
      if (offset) setChoices(previous => [...previous, ...rows]);
      else {
        setChoices(rows);
        if (!query) setSelectedChoice(previous => previous ?? rows[0] ?? null);
      }
      setTotal(previous => rows[0]?.total_count ?? (offset ? previous : 0));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load authorized vehicles.');
      if (!offset) setChoices([]);
    } finally {
      setBusy(false);
      setLoadingMore(false);
    }
  }, []);
  useEffect(() => { void load(debouncedSearch); }, [debouncedSearch]);
  const choice = selectedChoice;
  const policyStatus = getPolicyExpiryStatus(choice?.policy_end_date);
  const shown = choices;
  const choose = (row: PartnerClaimVehicleChoice) => {
    setSelectedChoice(row);
    setDropdownOpen(false);
    setSearch('');
  };
  const startClaim = async () => {
    if (!choice || creating) return;
    setCreating(true);
    try {
      const claimId = await createPartnerClaim(choice.customer_id, choice.vehicle_id, choice.policy_id);
      router.replace({ pathname: '/claim/stage', params: { id: claimId, key: 'spot_intimation' } } as never);
    } catch (reason) {
      Alert.alert('Claim could not be started', reason instanceof Error ? reason.message : 'Please try again or contact the claims desk.');
    } finally { setCreating(false); }
  };
  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to claims" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" color="#FFF" size={24}/>
      </Pressable>
      <Image source={require("../../assets/partner/icons/select-vehicle-claim.png")} resizeMode="contain" style={styles.headerArtwork} />
      <Text style={styles.headerTitle}>Select Vehicle</Text>
    </View>
    <ImageBackground source={require('../../assets/partner/backgrounds/CLAIMBG.jpeg')} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.vehicleSection}>
        <Text style={styles.heading}>Vehicle number *</Text>
        {dropdownOpen ? (
          <View style={styles.dropdown}>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={23} color="#1465BE"/>
              <TextInput
                accessibilityLabel="Search available vehicles"
                autoFocus
                value={search}
                onChangeText={setSearch}
                placeholder="Search vehicle number, make or model"
                placeholderTextColor="#7D8CA2"
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close vehicle search"
                onPress={() => { setSearch(''); setDropdownOpen(false); }}
                hitSlop={8}
                style={styles.searchClose}
              >
                <Ionicons name="chevron-up" size={22} color="#24528C"/>
              </Pressable>
            </View>
            {busy ? <Text style={styles.hint}>Loading authorized vehicles...</Text> : error ? <Text style={styles.error}>{error}</Text> : !shown.length ? <Text style={styles.hint}>No matching vehicles found.</Text> :
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always" style={styles.options}>
                {shown.map(row => {
                  const isSelected = choice?.customer_id === row.customer_id && choice?.vehicle_id === row.vehicle_id;
                  return (
                    <Pressable
                      key={row.customer_id + ':' + row.vehicle_id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => choose(row)}
                      style={[styles.option, isSelected && styles.optionSelected]}
                    >
                      <View style={styles.logo}>
                        {getPartnerManufacturerLogoSource(row.make) ? <Image source={getPartnerManufacturerLogoSource(row.make)!} resizeMode="contain" style={[styles.manufacturerLogoImage, manufacturerLogoAdjustment(row.make)]}/> : <Ionicons name="car-outline" size={24} color="#55789F"/>}
                      </View>
                      <View style={styles.vehicleText}>
                        <Text style={[styles.plate, isSelected && styles.plateSelected]}>{row.vehicle_no || 'Registration pending'}</Text>
                        <Text style={styles.description} numberOfLines={1}>{[row.make,row.model].filter(Boolean).join(' · ')}</Text>
                      </View>
                      {isSelected ? <Ionicons name="checkmark-circle" color="#0A4DA7" size={24}/> : null}
                    </Pressable>
                  );
                })}
                {shown.length < total ? <Pressable accessibilityRole="button" accessibilityLabel="Load more authorized vehicles" disabled={loadingMore} onPress={() => void load(debouncedSearch, shown.length)} style={{padding:14,alignItems:'center'}}><Text style={styles.hint}>{loadingMore ? 'Loading more vehicles…' : 'Load more vehicles'}</Text></Pressable> : null}
              </ScrollView>}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select vehicle number"
            accessibilityState={{ expanded: false }}
            onPress={() => setDropdownOpen(true)}
            style={styles.vehicleSelect}
          >
            {choice ? <View style={styles.logo}>{getPartnerManufacturerLogoSource(choice.make) ? <Image source={getPartnerManufacturerLogoSource(choice.make)!} resizeMode="contain" style={[styles.manufacturerLogoImage, manufacturerLogoAdjustment(choice.make)]}/> : <Ionicons name="car-outline" size={24} color="#55789F"/>}</View> : <Ionicons name="car-outline" size={23} color="#1D569B" />}
            <View style={styles.vehicleText}>
              <Text style={choice ? styles.plate : styles.placeholder}>{choice?.vehicle_no || 'Select vehicle number'}</Text>
              {choice ? <Text style={styles.description} numberOfLines={1}>{[choice.make,choice.model].filter(Boolean).join(' · ')}</Text> : null}
            </View>
            <Ionicons name="list" size={23} color="#24528C"/>
          </Pressable>
        )}
      </View>
      <View style={styles.policyTitle}><Text style={styles.heading}>Policy details</Text></View>
      {choice?.policy_id ? <View style={styles.policy}><PartnerInsurerLogo name={choice.insurer_name || ''} fallback={PartnerAssets.navigation.claims} style={styles.logoImage}/><View style={styles.vehicleText}><Text style={styles.policyNo}>{choice.policy_no || 'Policy number pending'}</Text><Text style={styles.policyCaption}>{choice.insurer_name || 'Insurer not recorded'}</Text><Text style={styles.policyCaption}>Expiry: {choice.policy_end_date || 'Not recorded'}</Text></View><View accessibilityLabel={`Policy status: ${policyStatus.label}`} style={[styles.policyIndicator, { backgroundColor: policyStatus.color }]}><Ionicons name={policyStatus.icon} size={14} color="#FFF"/></View></View> : <Text style={styles.hint}>No linked policy found. You can register the claim; coverage will be verified separately.</Text>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel claim setup" onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
        <Pressable disabled={!choice || creating} onPress={() => void startClaim()} style={[styles.primary,(!choice || creating) && styles.disabled]}><Text style={styles.primaryText}>{creating ? "Starting…" : "Start Claim"}</Text><Ionicons name="arrow-forward" color="#FFF" size={19}/></Pressable>
      </View>
    </ScrollView>
    </ImageBackground>
  </SafeAreaView>;
}
function getPolicyExpiryStatus(expiry: string | null | undefined): {
  label: string;
  color: string;
  icon: 'checkmark' | 'alert' | 'time-outline';
} {
  if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    return { label: 'Unknown', color: '#738399', icon: 'alert' };
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [year, month, day] = expiry.split('-').map(Number);
  const expiryUtc = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(expiryUtc) || new Date(expiryUtc).toISOString().slice(0, 10) !== expiry) {
    return { label: 'Unknown', color: '#738399', icon: 'alert' };
  }
  const daysUntilExpiry = Math.round((expiryUtc - todayUtc) / 86400000);
  if (daysUntilExpiry < 0) return { label: 'Expired', color: '#D84D5B', icon: 'alert' };
  if (daysUntilExpiry <= 30) return { label: 'Due', color: '#E89B21', icon: 'time-outline' };
  return { label: 'Active', color: '#20A56B', icon: 'checkmark' };
}

// Some supplied logos have substantial transparent space within the bitmap.
// Apply a small, make-specific optical adjustment without stretching the artwork.
function manufacturerLogoAdjustment(make: string | null | undefined) {
  const normalized = (make || '').trim().toLowerCase();
  const paddedMakes = ['mahindra', 'tata', 'hyundai', 'volkswagen'];
  if (paddedMakes.some(name => normalized === name || normalized.startsWith(name + ' '))) {
    return { transform: [{ scale: 1.12 }] };
  }
  return undefined;
}

const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:'#EDF5FF'},
 header:{height:67,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#081F4C'},
 back:{width:34,height:40,justifyContent:'center',alignItems:'center'},
 headerArtwork:{width:44,height:44},
 headerIcon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.16)',borderWidth:1,borderColor:'rgba(255,255,255,0.18)'},

 headerTitle:{color:'#FFF',fontSize:18,fontWeight:'900'},
 background:{flex:1},
 backgroundImage:{opacity:0.26},
 content:{padding:15,paddingBottom:35,gap:12,flexGrow:1},
 section:{backgroundColor:'#FFF',borderRadius:17,padding:14,borderWidth:1,borderColor:'#DEE8F4',gap:11},
 heading:{fontSize:14,fontWeight:'900',color:'#122E53'},
 vehicleSection:{gap:11},
 vehicleSelect:{backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#D7E3F2',padding:15,minHeight:76,flexDirection:'row',alignItems:'center',gap:13},
 placeholder:{fontSize:13,color:'#7890AC',fontWeight:'700'},
 dropdown:{backgroundColor:'#FFF',borderRadius:14,borderWidth:1.5,borderColor:'#A9C6E9',overflow:'hidden',shadowColor:'#0E3E7A',shadowOpacity:0.09,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:2},
 search:{minHeight:64,backgroundColor:'#F3F7FF',borderBottomWidth:1,borderBottomColor:'#E1E8F2',flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:10},
 input:{height:60,flex:1,fontSize:13,color:'#19365B',fontWeight:'700'},
 searchClose:{width:32,height:40,alignItems:'center',justifyContent:'center'},
 options:{maxHeight:300},
 option:{minHeight:68,flexDirection:'row',gap:10,alignItems:'center',paddingVertical:10,paddingHorizontal:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#D7E3F2',backgroundColor:'#FFF'},
 optionSelected:{backgroundColor:'#EEF5FF'},
 plateSelected:{color:'#0A3C82'},
 hint:{fontSize:11,color:'#667F9A',padding:9},
 error:{fontSize:11,color:'#B42318',padding:9},
 logo:{height:54,width:54,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:'#FFFFFF',overflow:'hidden'},
 manufacturerLogoImage:{height:54,width:54},
 logoImage:{height:32,width:32},
 vehicleText:{flex:1,minWidth:0},
 plate:{fontSize:13,fontWeight:'900',color:'#102B54'},
 description:{fontSize:10,color:'#59718F',marginTop:3},
 customer:{fontSize:9,color:'#7186A0',marginTop:3},
 policyTitle:{marginTop:5,paddingHorizontal:3},
 policy:{backgroundColor:'#FFFFFF',borderRadius:16,padding:15,flexDirection:'row',gap:13,alignItems:'center',borderWidth:1,borderColor:'#D7E3F2'},
 policyNo:{fontSize:13,fontWeight:'900',color:'#102B54'},
 policyCaption:{fontSize:10,color:'#52647D',marginTop:5},
 policyIndicator:{height:24,width:24,borderRadius:12,alignItems:'center',justifyContent:'center'},
 actions:{flexDirection:'row',gap:10,marginTop:5},
 secondary:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:13,borderWidth:1,borderColor:'#C3D4E8',minHeight:52},
 secondaryText:{color:'#154180',fontWeight:'800',fontSize:11},
 primary:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#0B347A',borderRadius:13,minHeight:52},
 disabled:{opacity:0.45},
 primaryText:{fontWeight:'900',fontSize:12,color:'#FFF'}
});
