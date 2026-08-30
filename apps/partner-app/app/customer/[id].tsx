import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { getPartnerCustomerDetail, type PartnerCustomerDetail } from '@/lib/customers';
import { partnerTheme } from '@/lib/theme';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerCustomerDetail(id));
    } catch {
      setError('This customer could not be loaded in your Partner scope.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen
      eyebrow="CUSTOMER STORY"
      title={data?.customer.customer_name || 'Customer'}
      action={
        <PartnerIconButton icon="close" label="Close customer detail" onPress={() => router.back()} />
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : error || !data ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error || 'Customer unavailable.'}</Text>
          <Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(data.customer.customer_name)}</Text></View>
            <View style={styles.heroBody}>
              <Text style={styles.heroName}>{data.customer.customer_name}</Text>
              <Text style={styles.heroMeta}>
                {[data.customer.city, data.customer.state].filter(Boolean).join(', ') || 'Location not recorded'}
                {data.customer.customer_code ? ` · ${data.customer.customer_code}` : ''}
              </Text>
              <Text style={styles.heroSince}>Customer record since {formatMonthYear(data.customer.created_at)}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <ContactAction
              icon="call-outline"
              label="Call"
              disabled={!data.customer.phone}
              onPress={() => data.customer.phone ? void Linking.openURL(`tel:${sanitizePhone(data.customer.phone)}`) : undefined}
            />
            <ContactAction
              icon="logo-whatsapp"
              label="WhatsApp"
              disabled={!data.customer.phone}
              onPress={() => data.customer.phone ? void Linking.openURL(`https://wa.me/91${lastTen(data.customer.phone)}`) : undefined}
            />
            <ContactAction
              icon="mail-outline"
              label="Email"
              disabled={!data.customer.email}
              onPress={() => data.customer.email ? void Linking.openURL(`mailto:${data.customer.email}`) : undefined}
            />
          </View>

          <View style={styles.summary}>
            <Summary value={data.summary.policies} label="Policies" />
            <Summary value={data.summary.vehicles} label="Vehicles" />
            <Summary value={data.summary.claims} label="Claims" />
            <Summary value={data.summary.renewals_30_days} label="Renewals" />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Relationship</Text>
          </View>
          <View style={styles.relationshipCard}>
            <Info label="Phone" value={data.customer.phone || 'Not recorded'} />
            <Info label="Email" value={data.customer.email || 'Not recorded'} />
            <Info label="Customer type" value={humanize(data.customer.customer_type || 'not recorded')} />
            <Info label="Fleet" value={humanize(data.customer.fleet_size_band || 'not recorded')} />
            <Info label="Intermediary" value={data.customer.intermediary_code || 'Organization / unassigned'} />
            <Info label="Status" value={humanize(data.customer.status || 'not recorded')} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Policies</Text>
            <Text style={styles.sectionHint}>{data.summary.policies} total</Text>
          </View>
          {data.policies.length ? (
            <View style={styles.stack}>
              {data.policies.map((policy) => (
                <Pressable key={policy.policy_id} onPress={() => router.push(`/policy/${policy.policy_id}` as never)} style={styles.itemCard}>
                  <View style={styles.itemIcon}><Ionicons name="document-text-outline" size={17} color={partnerTheme.colors.brand} /></View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{policy.policy_no || policy.policy_code || 'Policy'}</Text>
                    <Text style={styles.itemText}>
                      {[policy.insurer_name, policy.vehicle_no].filter(Boolean).join(' · ') || 'Policy details'}
                    </Text>
                    <Text style={styles.itemMeta}>Ends {formatDate(policy.end_date)} · {formatMoney(policy.premium_amount)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
                </Pressable>
              ))}
            </View>
          ) : <EmptyLine text="No scoped policies recorded." />}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicles</Text>
            <Text style={styles.sectionHint}>{data.summary.vehicles} total</Text>
          </View>
          {data.vehicles.length ? (
            <View style={styles.stack}>
              {data.vehicles.map((vehicle) => (
                <View key={vehicle.vehicle_id} style={styles.vehicleCard}>
                  <View style={styles.itemIcon}><Ionicons name="car-outline" size={18} color={partnerTheme.colors.accent} /></View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{vehicle.vehicle_no || 'Vehicle'}</Text>
                    <Text style={styles.itemText}>{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || humanize(vehicle.vehicle_type || 'vehicle')}</Text>
                    <View style={styles.expiryRow}>
                      <Expiry label="PUC" date={vehicle.puc_expiry_date} />
                      <Expiry label="Fitness" date={vehicle.fitness_expiry_date} />
                      <Expiry label="Road tax" date={vehicle.road_tax_expiry_date} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : <EmptyLine text="No vehicles recorded." />}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Claims</Text>
            <Text style={styles.sectionHint}>{data.summary.claims} total</Text>
          </View>
          {data.claims.length ? (
            <View style={styles.stack}>
              {data.claims.map((claim) => (
                <Pressable key={claim.claim_id} onPress={() => router.push(`/claim/${claim.claim_id}` as never)} style={styles.itemCard}>
                  <View style={styles.itemIcon}><Ionicons name="shield-outline" size={17} color={partnerTheme.colors.warning} /></View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{claim.claim_no || 'Claim'}</Text>
                    <Text style={styles.itemText}>{claim.current_status || 'Status unavailable'}</Text>
                    <Text style={styles.itemMeta}>{[claim.vehicle_no, claim.insurer_name].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
                </Pressable>
              ))}
            </View>
          ) : <EmptyLine text="No claims recorded." />}
        </>
      )}
    </PartnerScreen>
  );
}

function ContactAction({ icon, label, disabled, onPress }: {
  icon: 'call-outline' | 'logo-whatsapp' | 'mail-outline';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.actionDisabled]}>
      <Ionicons name={icon} size={18} color={disabled ? '#AAB2C0' : partnerTheme.colors.brand} />
      <Text style={[styles.actionText, disabled && styles.actionTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={2} style={styles.infoValue}>{value}</Text></View>;
}

function Expiry({ label, date }: { label: string; date: string | null }) {
  if (!date) return null;
  const days=daysUntil(date);
  const tone=days<0?styles.expiryBad:days<=30?styles.expiryWarn:styles.expiryGood;
  return <View style={[styles.expiry,tone]}><Text style={styles.expiryText}>{label} · {days<0?`${Math.abs(days)}d overdue`:`${days}d`}</Text></View>;
}

function EmptyLine({ text }: { text: string }) {
  return <View style={styles.emptyLine}><Text style={styles.emptyLineText}>{text}</Text></View>;
}

function sanitizePhone(value:string){return value.replace(/[^+\d]/g,'');}
function lastTen(value:string){return value.replace(/\D/g,'').slice(-10);}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0]?.toUpperCase()).join('')||'CU';}
function humanize(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());}
function formatDate(value:string|null){if(!value)return '—';const d=new Date(`${value}T00:00:00`);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'2-digit'}).format(d);}
function formatMonthYear(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'recorded date':new Intl.DateTimeFormat('en-IN',{month:'short',year:'numeric'}).format(d);}
function formatMoney(value:number|string|null){const amount=Number(value??0);return `₹${new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Number.isFinite(amount)?amount:0)}`;}
function daysUntil(value:string){const end=new Date(`${value}T00:00:00`);const today=new Date();today.setHours(0,0,0,0);return Math.ceil((end.getTime()-today.getTime())/86400000);}

const styles=StyleSheet.create({
  close:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  loading:{minHeight:280,alignItems:'center',justifyContent:'center'},
  errorCard:{minHeight:190,alignItems:'center',justifyContent:'center',borderRadius:partnerTheme.radius.lg,backgroundColor:partnerTheme.colors.surface},
  errorText:{color:partnerTheme.colors.inkMuted,fontSize:10,textAlign:'center'},
  retry:{marginTop:10,color:partnerTheme.colors.brand,fontSize:10,fontWeight:'800'},
  hero:{flexDirection:'row',alignItems:'center',gap:13,borderRadius:partnerTheme.radius.xl,padding:17,backgroundColor:partnerTheme.colors.nav},
  avatar:{width:52,height:52,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:'#343D52'},
  avatarText:{color:'#FFFFFF',fontSize:14,fontWeight:'900'},
  heroBody:{flex:1},
  heroName:{color:'#FFFFFF',fontSize:16,fontWeight:'800'},
  heroMeta:{marginTop:4,color:'#C2CAD7',fontSize:8.5,lineHeight:13},
  heroSince:{marginTop:6,color:'#8F9BAD',fontSize:7.5},
  actions:{marginTop:12,flexDirection:'row',gap:8},
  action:{flex:1,minHeight:50,alignItems:'center',justifyContent:'center',gap:4,borderRadius:14,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  actionDisabled:{backgroundColor:'#F2F4F7'},
  actionText:{color:partnerTheme.colors.ink,fontSize:8,fontWeight:'800'},
  actionTextDisabled:{color:'#AAB2C0'},
  summary:{marginTop:12,flexDirection:'row',borderRadius:17,paddingVertical:14,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  summaryItem:{flex:1,alignItems:'center'},
  summaryValue:{color:partnerTheme.colors.ink,fontSize:16,fontWeight:'800'},
  summaryLabel:{marginTop:3,color:partnerTheme.colors.inkMuted,fontSize:7},
  sectionHeader:{marginTop:20,marginBottom:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sectionTitle:{color:partnerTheme.colors.ink,fontSize:13.5,fontWeight:'800'},
  sectionHint:{color:partnerTheme.colors.inkMuted,fontSize:8},
  relationshipCard:{flexDirection:'row',flexWrap:'wrap',rowGap:13,borderRadius:17,padding:15,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  info:{width:'50%',paddingRight:8},
  infoLabel:{color:'#8A94A6',fontSize:7,fontWeight:'800',textTransform:'uppercase',letterSpacing:0.5},
  infoValue:{marginTop:3,color:partnerTheme.colors.ink,fontSize:9,fontWeight:'600',lineHeight:13},
  stack:{gap:8},
  itemCard:{minHeight:72,flexDirection:'row',alignItems:'center',gap:10,borderRadius:16,padding:12,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  vehicleCard:{minHeight:72,flexDirection:'row',alignItems:'flex-start',gap:10,borderRadius:16,padding:12,backgroundColor:partnerTheme.colors.surface,borderWidth:1,borderColor:partnerTheme.colors.line},
  itemIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.surfaceMuted},
  itemBody:{flex:1},
  itemTitle:{color:partnerTheme.colors.ink,fontSize:10.5,fontWeight:'800'},
  itemText:{marginTop:3,color:partnerTheme.colors.inkMuted,fontSize:8.5},
  itemMeta:{marginTop:4,color:'#7A8495',fontSize:7.5},
  expiryRow:{marginTop:7,flexDirection:'row',flexWrap:'wrap',gap:5},
  expiry:{borderRadius:999,paddingHorizontal:6,paddingVertical:3},
  expiryGood:{backgroundColor:'#EAF7EF'},
  expiryWarn:{backgroundColor:'#FFF2DD'},
  expiryBad:{backgroundColor:'#FCEDEC'},
  expiryText:{color:'#596579',fontSize:6.8,fontWeight:'700'},
  emptyLine:{minHeight:70,alignItems:'center',justifyContent:'center',borderRadius:15,backgroundColor:partnerTheme.colors.surface},
  emptyLineText:{color:partnerTheme.colors.inkMuted,fontSize:8.5},
});
