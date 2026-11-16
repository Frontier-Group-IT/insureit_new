import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { listLifeHealthCases, type LifeHealthCaseSummary, type LifeHealthStatus, type CaseCounts } from '@/lib/life-health-cases';
import { canPartnerAccessCaseRegister } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const filters: Array<{key:LifeHealthStatus;label:string}> = [
  {key:'pending',label:'Pending'},{key:'rejected',label:'Rejected'},
  {key:'issued',label:'Issued'},{key:'all',label:'All'},
];
const EMPTY: CaseCounts = {pending:0,rejected:0,issued:0,all:0};
const navy='#17365D';
export default function LifeHealthCaseRegisterScreen() {
 const router=useRouter();
 const {context}=usePartnerSession();
 const [status,setStatus]=useState<LifeHealthStatus>('pending');
 const [query,setQuery]=useState('');
 const [search,setSearch]=useState('');
 const [rows,setRows]=useState<LifeHealthCaseSummary[]>([]);
 const [counts,setCounts]=useState<CaseCounts>(EMPTY);
 const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(true);
 const [more,setMore]=useState(false);
 const [error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{ const timeout=setTimeout(()=>setSearch(query.trim()),300);return ()=>clearTimeout(timeout);},[query]);
 const load=useCallback(async(offset=0)=>{
   const seq=++generation.current;
   if(offset===0)setLoading(true);else setMore(true);
   setError('');
   try {
     const result=await listLifeHealthCases({status,search,offset,limit:10});
     if(seq!==generation.current)return;
     setRows(old=>offset===0?result.cases:[...old,...result.cases.filter(row=>!old.some(existing=>existing.id===row.id))]);
     setCounts(result.counts);
     setTotal(result.total);
   } catch(cause) {
     if(seq===generation.current)setError(cause instanceof Error?cause.message:'Unable to load cases.');
   } finally {
     if(seq===generation.current){setLoading(false);setMore(false);}
   }
 },[status,search]);
 useFocusEffect(useCallback(()=>{
   void load();
   return ()=>{generation.current++;};
 },[load]));
 if(!canPartnerAccessCaseRegister(context))return (
   <PartnerScreen title="Case Register" onBack={()=>router.back()}>
     <Text style={styles.message}>Your Operations Portal permissions do not allow Case Register access.</Text>
   </PartnerScreen>
 );
 return (
   <PartnerScreen title="Case Register" navyTopBar navyStatusBar onBack={()=>router.back()}>
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
     {loading?<ActivityIndicator color={navy} style={{marginTop:24}}/>:
       rows.length===0?<Text style={styles.message}>No matching cases found.</Text>:
       <View style={styles.list}>
         <View style={styles.listHeading}>
           <Text style={styles.listTitle}>{status==='all'?'All Cases':`${filters.find(item=>item.key===status)?.label} Cases`}</Text>
         </View>
         <View style={styles.caseRows}>
           {rows.map(row=><Pressable
             key={row.id}
             accessibilityRole="button"
             accessibilityLabel={`Open ${row.business_line} case ${row.case_number} for ${row.customer_name || 'customer'}`}
             onPress={()=>router.push(`/life-health-cases/${row.id}` as never)}
             style={({pressed})=>[styles.caseRow,pressed&&styles.caseRowPressed]}
           >
             <View style={styles.logoShell}>
               <Ionicons name="document-text-outline" size={21} color="#3156B8"/>
               {row.insurer_name?<PartnerInsurerLogo
                 name={row.insurer_name}
                 style={styles.insurerLogo}
                 accessibilityLabel={row.insurer_name}
               />:null}
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
         {rows.length<total?<Pressable disabled={more} style={styles.more} onPress={()=>void load(rows.length)}>
           {more?<ActivityIndicator color={navy}/>:<Text style={styles.moreText}>Load More ({rows.length} of {total})</Text>}
         </Pressable>:null}
       </View>}
   </PartnerScreen>
 );
}
const styles=StyleSheet.create({
 searchWrap:{flexDirection:'row',alignItems:'center',borderRadius:12,borderWidth:1,borderColor:'#CBD8E7',backgroundColor:'#FFF',paddingHorizontal:12,height:44,gap:8,marginTop:4,marginBottom:8},
 search:{flex:1,color:'#172B4D',fontSize:12},
 filters:{marginTop:12,marginBottom:8,flexGrow:0},
 filtersContent:{flexDirection:'row',alignItems:'center',gap:6,paddingRight:4},
 filter:{borderRadius:10,borderColor:'#D6E0EE',borderWidth:1,paddingVertical:9,paddingHorizontal:10,backgroundColor:'#FFF'},
 filterSelected:{backgroundColor:navy,borderColor:navy},
 filterText:{fontSize:11,color:'#49617D',fontWeight:'700'},
 filterTextSelected:{color:'#FFF'},
 list:{gap:7,paddingBottom:20},
 listHeading:{marginTop:8,marginBottom:3},
 listTitle:{fontSize:12,fontWeight:'800',color:'#142B4E'},
 caseRows:{gap:3},
 caseRow:{minHeight:60,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#FFF',borderColor:'#E2E9F3',borderWidth:1,borderRadius:8,paddingHorizontal:8,paddingVertical:6},
 caseRowPressed:{backgroundColor:'#F6F9FF'},
 logoShell:{width:36,height:36,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#F5F8FC',borderColor:'#E2E9F3',borderWidth:1,overflow:'hidden'},
 insurerLogo:{width:31,height:31,position:'absolute'},
 caseMain:{flex:1,minWidth:0,gap:2},
 customerName:{fontSize:12,lineHeight:16,fontWeight:'800',color:'#173A7D'},
 caseNumber:{fontSize:10,lineHeight:13,color:'#5C6C84',fontWeight:'600'},
 caseMeta:{fontSize:9,lineHeight:12,color:'#7D8CA1',fontWeight:'600'},
 caseRight:{width:108,alignItems:'flex-end',justifyContent:'center',gap:5},
 statusPill:{flexDirection:'row',alignItems:'center',gap:4,borderRadius:99,paddingHorizontal:8,paddingVertical:4},
 statusDot:{width:5,height:5,borderRadius:3},
 statusText:{fontSize:9,fontWeight:'700'},
 issued:{backgroundColor:'#EAF8F2'},
 rejected:{backgroundColor:'#FDECEC'},
 pending:{backgroundColor:'#FFF5E5'},
 issuedDot:{backgroundColor:'#1D9A68'},
 rejectedDot:{backgroundColor:'#D04C4C'},
 pendingDot:{backgroundColor:'#C47B12'},
 issuedText:{color:'#1D9A68'},
 rejectedText:{color:'#D04C4C'},
 pendingText:{color:'#956516'},
 amount:{fontSize:10,fontWeight:'800',color:navy,textAlign:'right'},
 more:{minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:'#F1F5FD',borderRadius:8,marginTop:5},
 moreText:{color:'#3156B8',fontWeight:'800',fontSize:10},
 error:{padding:12,backgroundColor:'#FEF0EF',borderRadius:10,marginVertical:8},
 errorText:{color:'#A22D36',fontSize:12},
 retry:{color:'#174A96',fontWeight:'800',marginTop:8},
 message:{textAlign:'center',color:'#66758C',fontSize:12,marginTop:25},
});
