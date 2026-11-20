import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { listLifeHealthCases, type LifeHealthCaseSummary, type LifeHealthStatus, type LifeHealthBusinessLine, type CaseCounts } from '@/lib/life-health-cases';
import { canPartnerAccessCaseRegister } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const filters: Array<{key:LifeHealthStatus;label:string}> = [
  {key:'pending',label:'Pending'},{key:'rejected',label:'Rejected'},
  {key:'issued',label:'Issued'},{key:'all',label:'All'},
];
const businessLineOptions: Array<{key:LifeHealthBusinessLine;label:string}> = [
  {key:'all',label:'All'},{key:'life',label:'Life'},{key:'health',label:'Health'},
];
const EMPTY: CaseCounts = {pending:0,rejected:0,issued:0,all:0};
const navy='#071E49';
export default function LifeHealthCaseRegisterScreen() {
 const router=useRouter();
 const {context}=usePartnerSession();
 const [status,setStatus]=useState<LifeHealthStatus>('pending');
 const [businessLine,setBusinessLine]=useState<LifeHealthBusinessLine>('all');
 const [businessLineMenuOpen,setBusinessLineMenuOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [search,setSearch]=useState('');
 const [rows,setRows]=useState<LifeHealthCaseSummary[]>([]);
 const [counts,setCounts]=useState<CaseCounts>(EMPTY);
 const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(true);
 const [more,setMore]=useState(false);
 const [error,setError]=useState('');
 const [issuedCase,setIssuedCase]=useState<LifeHealthCaseSummary|null>(null);
 const generation=useRef(0);
 useEffect(()=>{ const timeout=setTimeout(()=>setSearch(query.trim()),300);return ()=>clearTimeout(timeout);},[query]);
 const load=useCallback(async(offset=0)=>{
   const seq=++generation.current;
   if(offset===0)setLoading(true);else setMore(true);
   setError('');
   try {
     const result=await listLifeHealthCases({status,businessLine,search,offset,limit:10});
     if(seq!==generation.current)return;
     setRows(old=>offset===0?result.cases:[...old,...result.cases.filter(row=>!old.some(existing=>existing.id===row.id))]);
     setCounts(result.counts);
     setTotal(result.total);
   } catch(cause) {
     if(seq===generation.current)setError(cause instanceof Error?cause.message:'Unable to load cases.');
   } finally {
     if(seq===generation.current){setLoading(false);setMore(false);}
   }
 },[status,businessLine,search]);
 useFocusEffect(useCallback(()=>{
   void load();
   return ()=>{generation.current++;};
 },[load]));
 if(!canPartnerAccessCaseRegister(context))return (
   <PartnerScreen title="Case Register" navyTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation/>} onBack={()=>router.back()}>
     <Text style={styles.message}>Your Operations Portal permissions do not allow Case Register access.</Text>
   </PartnerScreen>
 );
 return (
   <PartnerScreen title="Case Register" navyTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation/>} onBack={()=>router.back()}>
     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
       {filters.map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityState={{selected:status===item.key}}
           onPress={()=>setStatus(item.key)} style={[styles.filter,status===item.key&&styles.filterSelected]}>
           <Text numberOfLines={1} style={[styles.filterText,status===item.key&&styles.filterTextSelected]}>{item.label} ({counts[item.key]})</Text>
       </Pressable>)}
     </ScrollView>
     <View style={styles.searchWrap}>
       <Ionicons name="search-outline" size={19} color="#63748A"/>
       <TextInput value={query} onChangeText={setQuery} style={styles.search}
         placeholder="Case, customer, mobile, insurer, proposal..." placeholderTextColor="#8390A5" autoCapitalize="none"/>
       {query?<Pressable accessibilityLabel="Clear case search" onPress={()=>setQuery('')}><Ionicons name="close-circle" size={18} color="#70819A"/></Pressable>:null}
     </View>
     {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
       <Pressable onPress={()=>void load()}><Text style={styles.retry}>Retry</Text></Pressable></View>:null}
     <View style={styles.listHeading}>
       <Text style={styles.listTitle}>{status==='all'?'All Cases':`${filters.find(item=>item.key===status)?.label} Cases`}</Text>
       <Pressable
         accessibilityRole="button"
         accessibilityLabel={`Filter cases by business line: ${businessLineOptions.find(item=>item.key===businessLine)?.label}`}
         accessibilityState={{expanded:businessLineMenuOpen}}
         onPress={()=>setBusinessLineMenuOpen(open=>!open)}
         style={styles.businessLineSelect}
       >
         <Text style={styles.businessLineSelectText}>{businessLineOptions.find(item=>item.key===businessLine)?.label}</Text>
         <Feather name="chevron-down" size={13} color="#49617D"/>
       </Pressable>
     </View>
     {businessLineMenuOpen?<View style={styles.businessLineMenu}>
       {businessLineOptions.map(item=><Pressable key={item.key}
         accessibilityRole="button"
         accessibilityState={{selected:businessLine===item.key}}
         onPress={()=>{setBusinessLineMenuOpen(false);setBusinessLine(item.key);}}
         style={[styles.businessLineOption,businessLine===item.key&&styles.businessLineOptionSelected]}>
         <Text style={[styles.businessLineOptionText,businessLine===item.key&&styles.businessLineOptionTextSelected]}>{item.label}</Text>
         {businessLine===item.key?<Feather name="check" size={13} color="#173A7D"/>:null}
       </Pressable>)}
     </View>:null}
     {loading?<ActivityIndicator color={navy} style={{marginTop:24}}/>:
       rows.length===0?<Text style={styles.message}>No matching cases found.</Text>:
       <View style={styles.list}>
         <View style={styles.caseRows}>
           {rows.map(row=><Pressable
             key={row.id}
             accessibilityRole="button"
             accessibilityLabel={`Open ${row.business_line} case ${row.case_number} for ${row.customer_name || 'customer'}`}
             onPress={()=>row.status_group==='issued' && row.final_policy_id ? setIssuedCase(row) : router.push(`/life-health-cases/${row.id}` as never)}
             style={({pressed})=>[styles.caseRow,pressed&&styles.caseRowPressed]}
           >
             <View style={styles.logoShell}>
               <PartnerInsurerLogo
                 name={row.insurer_name}
                 style={styles.insurerLogo}
                 accessibilityLabel={row.insurer_name || 'Insurer logo unavailable'}
                 fallbackContent={<Ionicons name="document-text-outline" size={23} color="#3156B8"/>}
               />
             </View>
             <View style={styles.caseMain}>
               <Text style={styles.customerName} numberOfLines={1}>{row.customer_name||'Customer pending'}</Text>
               <Text style={styles.caseNumber} numberOfLines={1}>{row.case_number}</Text>
               <Text style={styles.caseMeta} numberOfLines={1}>{row.business_line||'Life & Health'} · {row.proposal_number||'Proposal pending'}</Text>
             </View>
             <View style={styles.caseRight}>
               <View style={[styles.statusPill,row.status_group==='issued'?styles.issued:row.status_group==='rejected'?styles.rejected:styles.pending]}>
                 <View style={[styles.statusDot,row.status_group==='issued'?styles.issuedDot:row.status_group==='rejected'?styles.rejectedDot:styles.pendingDot]}/>
                 <Text style={[styles.statusText,row.status_group==='issued'?styles.issuedText:row.status_group==='rejected'?styles.rejectedText:styles.pendingText]}>{row.status_group==='issued'?'Issued':row.status_group==='rejected'?'Rejected':'Pending'}</Text>
               </View>
               <Text style={styles.amount} numberOfLines={1}>₹{row.premium_amount.toLocaleString('en-IN',{maximumFractionDigits:2})}</Text>
             </View>
           </Pressable>)}
         </View>
         {rows.length<total?<Pressable
           accessibilityRole="button"
           accessibilityLabel={more?'Loading more cases':'Load More Cases'}
           accessibilityState={{disabled:more,busy:more}}
           disabled={more}
           style={({pressed})=>[styles.more,more&&styles.moreLoading,pressed&&!more&&styles.morePressed]}
           onPress={()=>void load(rows.length)}>
           {more?<>
             <ActivityIndicator size="small" color="#FFFFFF"/>
             <Text style={styles.moreTextLoading}>Loading more cases…</Text>
           </>:<>
             <Text style={styles.moreText}>Load More Cases</Text>
             <Feather name="chevron-down" size={13} color="#3156B8"/>
           </>}
         </Pressable>:null}
       </View>}
     <Modal visible={Boolean(issuedCase)} transparent animationType="fade" onRequestClose={()=>setIssuedCase(null)}>
       <View style={styles.modalBackdrop}>
         <Pressable accessibilityLabel="Close issued policy popup" style={StyleSheet.absoluteFill} onPress={()=>setIssuedCase(null)}/>
         <View style={styles.modalCard} accessibilityRole="alert">
           <View style={styles.modalIntro}>
             <View style={styles.modalCheck}><Ionicons name="checkmark-circle-outline" size={22} color="#18794E"/></View>
             <View style={styles.modalCopy}>
               <Text style={styles.modalTitle}>Policy already issued</Text>
               <Text style={styles.modalDescription}>This case has already been issued as a policy. Open the issued policy to view and edit its details.</Text>
             </View>
           </View>
           <View style={styles.modalActions}>
             <Pressable accessibilityRole="button" onPress={()=>setIssuedCase(null)} style={styles.modalClose}><Text style={styles.modalCloseText}>Close</Text></Pressable>
             <Pressable accessibilityRole="button" accessibilityLabel="View issued policy details in Partner App"
               onPress={()=>{
                 if(!issuedCase?.final_policy_id)return;
                 const policyId=issuedCase.final_policy_id;
                 setIssuedCase(null);
                 router.push(`/policy/${policyId}` as never);
               }} style={styles.modalView}><Text style={styles.modalViewText}>View Policy</Text></Pressable>
           </View>
         </View>
       </View>
     </Modal>
   </PartnerScreen>
 );
}
const styles=StyleSheet.create({
 modalBackdrop:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(15,23,42,0.28)',padding:20},
 modalCard:{width:'100%',maxWidth:390,backgroundColor:'#FFFFFF',borderRadius:18,borderWidth:1,borderColor:'#D9E2F0',padding:20},
 modalIntro:{flexDirection:'row',alignItems:'flex-start',gap:12},
 modalCheck:{width:40,height:40,borderRadius:20,backgroundColor:'#EAF7F2',alignItems:'center',justifyContent:'center'},
 modalCopy:{flex:1},
 modalTitle:{fontSize:15,fontWeight:'700',color:'#000000'},
 modalDescription:{marginTop:7,fontSize:11,lineHeight:19,color:'#667085'},
 modalActions:{marginTop:20,borderTopWidth:1,borderColor:'#E8EDF3',paddingTop:14,flexDirection:'row',justifyContent:'flex-end',gap:9},
 modalClose:{borderWidth:1,borderColor:'#CAD7E7',borderRadius:9,paddingHorizontal:16,paddingVertical:11,justifyContent:'center'},
 modalCloseText:{fontSize:11,fontWeight:'700',color:'#475467'},
 modalView:{backgroundColor:'#17365D',borderRadius:9,paddingHorizontal:16,paddingVertical:11,justifyContent:'center'},
 modalViewText:{fontSize:11,fontWeight:'700',color:'#FFFFFF'},
 searchWrap:{flexDirection:'row',alignItems:'center',borderRadius:12,borderWidth:1,borderColor:'#CBD8E7',backgroundColor:'#FFF',paddingHorizontal:12,height:44,gap:8,marginTop:4,marginBottom:8},
 search:{flex:1,color:'#172B4D',fontSize:12},
 filters:{marginTop:12,marginBottom:8,flexGrow:0},
 filtersContent:{flexDirection:'row',alignItems:'center',gap:6,paddingRight:4},
 filter:{borderRadius:10,borderColor:'#D6E0EE',borderWidth:1,paddingVertical:9,paddingHorizontal:10,backgroundColor:'#FFF'},
 filterSelected:{backgroundColor:navy,borderColor:navy},
 filterText:{fontSize:11,color:'#49617D',fontWeight:'700'},
 filterTextSelected:{color:'#FFF'},
 list:{gap:7,paddingBottom:20},
 listHeading:{marginTop:8,marginBottom:3,flexDirection:'row',alignItems:'center',justifyContent:'flex-start',gap:9},
 businessLineSelect:{minWidth:85,minHeight:32,paddingHorizontal:11,borderRadius:9,borderWidth:1,borderColor:'#CAD7E7',backgroundColor:'#FFFFFF',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},
 businessLineSelectText:{fontSize:11,fontWeight:'700',color:'#173A7D'},
 businessLineMenu:{alignSelf:'flex-start',width:110,marginTop:3,marginBottom:7,borderRadius:10,borderWidth:1,borderColor:'#D6E0EE',backgroundColor:'#FFFFFF',overflow:'hidden'},
 businessLineOption:{minHeight:37,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 businessLineOptionSelected:{backgroundColor:'#EEF4FF'},
 businessLineOptionText:{fontSize:11,color:'#49617D',fontWeight:'600'},
 businessLineOptionTextSelected:{color:'#173A7D',fontWeight:'800'},
 listTitle:{fontSize:12,fontWeight:'800',color:'#000000'},
 caseRows:{gap:3},
 // Match the Policies tab's compact record geometry while preserving case-specific data.
 caseRow:{minHeight:54,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#FFF',borderColor:'#E2E9F3',borderWidth:1,borderRadius:8,paddingHorizontal:8,paddingVertical:4},
 caseRowPressed:{backgroundColor:'#F6F9FF'},
 logoShell:{width:32,height:32,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#F5F8FC',borderWidth:StyleSheet.hairlineWidth,borderColor:'#E2E9F3',overflow:'hidden'},
 insurerLogo:{width:27,height:27},
 caseMain:{flex:1,minWidth:0},
 customerName:{fontSize:12,lineHeight:15,fontWeight:Platform.OS==='ios'?'400':'800',color:'#173A7D'},
 caseNumber:{marginTop:1,fontSize:8.2,lineHeight:11,color:'#5C6C84',fontWeight:Platform.OS==='ios'?'400':'600'},
 caseMeta:{marginTop:1,fontSize:7.6,lineHeight:10,color:'#7D8CA1',fontWeight:Platform.OS==='ios'?'400':'600'},
 caseRight:{width:104,alignItems:'flex-end'},
 statusPill:{flexDirection:'row',alignItems:'center',gap:3,borderRadius:999,paddingHorizontal:7,paddingVertical:4},
 statusDot:{width:4,height:4,borderRadius:2},
 statusText:{fontSize:7.4,lineHeight:10,fontWeight:Platform.OS==='ios'?'400':'800'},
 issued:{backgroundColor:'#EAF8F2'},
 rejected:{backgroundColor:'#FDECEC'},
 pending:{backgroundColor:'#FFF5E5'},
 issuedDot:{backgroundColor:'#1D9A68'},
 rejectedDot:{backgroundColor:'#D04C4C'},
 pendingDot:{backgroundColor:'#C47B12'},
 issuedText:{color:'#1D9A68'},
 rejectedText:{color:'#D04C4C'},
 pendingText:{color:'#956516'},
 amount:{marginTop:2,fontSize:8.2,lineHeight:11,fontWeight:Platform.OS==='ios'?'400':'800',color:navy,textAlign:'right'},
 more:{marginHorizontal:12,marginTop:5,minHeight:36,alignSelf:'stretch',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,borderRadius:8,backgroundColor:'#F1F5FD'},
 moreLoading:{backgroundColor:'#3156B8'},
 morePressed:{opacity:0.72},
 moreText:{color:'#3156B8',fontSize:8,lineHeight:11,fontWeight:Platform.OS==='ios'?'400':'800'},
 moreTextLoading:{color:'#FFFFFF',fontSize:8.5,lineHeight:12,fontWeight:Platform.OS==='ios'?'400':'800'},
 error:{padding:12,backgroundColor:'#FEF0EF',borderRadius:10,marginVertical:8},
 errorText:{color:'#A22D36',fontSize:12},
 retry:{color:'#174A96',fontWeight:'800',marginTop:8},
 message:{textAlign:'center',color:'#66758C',fontSize:12,marginTop:25},
});
